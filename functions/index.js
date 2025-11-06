/* ============================================
   AJUPAM PAGER - CLOUD FUNCTIONS
   Sistema de Notificaciones Push
   Versión: 1.0.0
   ============================================ */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/* ============================================
   FUNCIÓN PRINCIPAL: Enviar Notificaciones
   Trigger: onCreate en la colección "notifications"
   ============================================ */
exports.sendCourtNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        try {
            const notification = snapshot.data();
            const notificationId = context.params.notificationId;
            
            console.log(`📨 [${notificationId}] Procesando nueva notificación...`);
            
            // Validar que existan tokens
            if (!notification.tokens || !Array.isArray(notification.tokens) || notification.tokens.length === 0) {
                console.error(`❌ [${notificationId}] No hay tokens para enviar`);
                await snapshot.ref.update({ 
                    status: 'failed',
                    error: 'No tokens provided',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }

            const { courtNumber, message, tokens } = notification;
            
            console.log(`📱 [${notificationId}] Enviando a ${tokens.length} dispositivos`);
            console.log(`🎾 Cancha: ${courtNumber}`);
            
            // Construir el mensaje de notificación
            const notificationTitle = `¡Cancha ${courtNumber} Disponible!`;
            const notificationBody = message || `La cancha ${courtNumber} está libre. ¡Reservá ahora!`;

            // Preparar el payload
            const payload = {
                notification: {
                    title: notificationTitle,
                    body: notificationBody,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-72.png',
                },
                data: {
                    courtId: notification.courtId || '',
                    courtNumber: courtNumber.toString(),
                    click_action: 'https://ajupam.ar/pager/',
                    timestamp: Date.now().toString()
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'ajupam-canchas',
                        priority: 'high'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                            'content-available': 1
                        }
                    }
                },
                webpush: {
                    notification: {
                        requireInteraction: true,
                        vibrate: [200, 100, 200],
                        icon: '/icons/icon-192.png',
                        badge: '/icons/icon-72.png',
                        tag: `cancha-${courtNumber}`,
                        renotify: true
                    },
                    fcmOptions: {
                        link: 'https://ajupam.ar/pager/'
                    }
                }
            };

            // Enviar en lotes de 500 (límite de FCM)
            const batchSize = 500;
            let successCount = 0;
            let failureCount = 0;
            const failedTokens = [];

            for (let i = 0; i < tokens.length; i += batchSize) {
                const batchTokens = tokens.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                
                console.log(`📤 [${notificationId}] Enviando lote ${batchNumber} (${batchTokens.length} tokens)...`);
                
                try {
                    // Enviar usando sendEachForMulticast (más confiable que sendToDevice)
                    const response = await admin.messaging().sendEachForMulticast({
                        tokens: batchTokens,
                        ...payload
                    });

                    successCount += response.successCount;
                    failureCount += response.failureCount;

                    // Procesar resultados individuales
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            const token = batchTokens[idx];
                            failedTokens.push(token);
                            
                            if (resp.error) {
                                const errorCode = resp.error.code;
                                console.warn(`⚠️ Token fallido [${errorCode}]: ${token.substring(0, 20)}...`);
                                
                                // Tokens que deben ser eliminados
                                if (errorCode === 'messaging/invalid-registration-token' ||
                                    errorCode === 'messaging/registration-token-not-registered') {
                                    console.log(`🗑️ Token inválido marcado para eliminación`);
                                }
                            }
                        }
                    });

                    console.log(`✅ [${notificationId}] Lote ${batchNumber}: ${response.successCount} enviados, ${response.failureCount} fallidos`);

                } catch (error) {
                    console.error(`❌ [${notificationId}] Error en lote ${batchNumber}:`, error);
                    failureCount += batchTokens.length;
                    failedTokens.push(...batchTokens);
                }
            }

            // Actualizar el documento de notificación con los resultados
            const updateData = {
                status: 'sent',
                successCount: successCount,
                failureCount: failureCount,
                totalSent: tokens.length,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (failedTokens.length > 0) {
                updateData.failedTokens = failedTokens;
            }

            await snapshot.ref.update(updateData);

            // Limpiar tokens inválidos de la colección subscriptions
            if (failedTokens.length > 0) {
                console.log(`🧹 [${notificationId}] Limpiando ${failedTokens.length} tokens inválidos...`);
                
                const cleanupPromises = failedTokens.map(async (token) => {
                    try {
                        const subsSnapshot = await admin.firestore()
                            .collection('subscriptions')
                            .where('token', '==', token)
                            .get();
                        
                        if (!subsSnapshot.empty) {
                            const deletions = subsSnapshot.docs.map(doc => doc.ref.delete());
                            await Promise.all(deletions);
                            console.log(`✅ Token limpiado: ${token.substring(0, 20)}...`);
                        }
                    } catch (error) {
                        console.error(`❌ Error limpiando token:`, error);
                    }
                });

                await Promise.all(cleanupPromises);
                console.log(`✅ [${notificationId}] Limpieza completada`);
            }

            // Log final
            console.log(`✅ [${notificationId}] COMPLETADO`);
            console.log(`   📊 Exitosos: ${successCount}/${tokens.length}`);
            console.log(`   ❌ Fallidos: ${failureCount}/${tokens.length}`);
            console.log(`   🧹 Tokens limpiados: ${failedTokens.length}`);

            return null;

        } catch (error) {
            console.error('❌ Error crítico en sendCourtNotification:', error);
            
            // Actualizar estado de error
            try {
                await snapshot.ref.update({
                    status: 'failed',
                    error: error.message,
                    errorStack: error.stack,
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error('❌ Error actualizando estado de fallo:', updateError);
            }

            return null;
        }
    });

/* ============================================
   FUNCIÓN: Limpiar Suscripciones Antiguas
   Trigger: Scheduled (cron) - Cada 7 días
   ============================================ */
exports.cleanupOldSubscriptions = functions.pubsub
    .schedule('0 2 * * 0')  
    .timeZone('America/Buenos_Aires')
    .onRun(async (context) => {
        try {
            console.log('🧹 Iniciando limpieza de suscripciones antiguas...');

            // Eliminar suscripciones sin actividad por más de 90 días
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            const snapshot = await admin.firestore()
                .collection('subscriptions')
                .where('subscribedAt', '<', cutoffDate)
                .get();

            if (snapshot.empty) {
                console.log('✅ No hay suscripciones antiguas para limpiar');
                return null;
            }

            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);

            console.log(`✅ Limpieza completada: ${snapshot.size} suscripciones eliminadas`);
            return null;

        } catch (error) {
            console.error('❌ Error en cleanupOldSubscriptions:', error);
            return null;
        }
    });

/* ============================================
   FUNCIÓN: Limpiar Notificaciones Antiguas
   Trigger: Scheduled (cron) - Cada 30 días
   ============================================ */
exports.cleanupOldNotifications = functions.pubsub
    .schedule('every 30 days')
    .timeZone('America/Buenos_Aires')
    .onRun(async (context) => {
        try {
            console.log('🧹 Iniciando limpieza de notificaciones antiguas...');

            // Eliminar notificaciones de más de 30 días
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            const snapshot = await admin.firestore()
                .collection('notifications')
                .where('timestamp', '<', cutoffDate)
                .get();

            if (snapshot.empty) {
                console.log('✅ No hay notificaciones antiguas para limpiar');
                return null;
            }

            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);

            console.log(`✅ Limpieza completada: ${snapshot.size} notificaciones eliminadas`);
            return null;

        } catch (error) {
            console.error('❌ Error en cleanupOldNotifications:', error);
            return null;
        }
    });