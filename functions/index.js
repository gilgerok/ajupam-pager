const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Cloud Function que se dispara cuando se crea una nueva notificación
 * Envía push notifications a todos los tokens suscritos
 */
exports.sendCourtNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        const notificationId = context.params.notificationId;
        
        console.log('🔔 Nueva notificación creada:', notificationId);
        console.log('📋 Datos:', notification);
        
        try {
            const { courtId, courtNumber, message, tokens } = notification;
            
            // Validar que existan tokens
            if (!tokens || tokens.length === 0) {
                console.warn('⚠️ No hay tokens para enviar');
                await snap.ref.update({
                    status: 'failed',
                    error: 'No tokens provided',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return null;
            }
            
            // Construir el mensaje de notificación
            const payload = {
                notification: {
                    title: `🎾 Cancha ${courtNumber} Disponible!`,
                    body: message || '¡La cancha está libre para jugar! Apurate que se llena rápido.',
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-72.png',
                    tag: `court-${courtId}`,
                    requireInteraction: 'true'
                },
                data: {
                    courtId: courtId.toString(),
                    courtNumber: courtNumber.toString(),
                    clickAction: '/',
                    url: '/'
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        icon: '/icons/icon-192.png',
                        badge: '/icons/icon-72.png',
                        vibrate: [200, 100, 200],
                        requireInteraction: true,
                        actions: [
                            {
                                action: 'open',
                                title: 'Ver App'
                            }
                        ]
                    },
                    fcmOptions: {
                        link: '/'
                    }
                }
            };
            
            console.log(`📤 Enviando a ${tokens.length} dispositivos...`);
            
            // Enviar notificaciones (máximo 500 tokens por batch)
            const batchSize = 500;
            let successCount = 0;
            let failureCount = 0;
            const failedTokens = [];
            
            for (let i = 0; i < tokens.length; i += batchSize) {
                const batch = tokens.slice(i, i + batchSize);
                
                try {
                    const response = await admin.messaging().sendToDevice(batch, payload, {
                        priority: 'high',
                        timeToLive: 60 * 60 * 24 // 24 horas
                    });
                    
                    successCount += response.successCount;
                    failureCount += response.failureCount;
                    
                    // Recopilar tokens que fallaron
                    if (response.results) {
                        response.results.forEach((result, index) => {
                            if (result.error) {
                                const errorCode = result.error.code;
                                const token = batch[index];
                                
                                console.error(`❌ Error en token ${index}:`, errorCode);
                                
                                // Si el token es inválido o no está registrado, guardarlo para eliminarlo
                                if (errorCode === 'messaging/invalid-registration-token' ||
                                    errorCode === 'messaging/registration-token-not-registered') {
                                    failedTokens.push(token);
                                }
                            }
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ Error al enviar batch:', error);
                    failureCount += batch.length;
                }
            }
            
            console.log(`✅ Enviadas: ${successCount} exitosas, ${failureCount} fallidas`);
            
            // Actualizar el documento de notificación con los resultados
            await snap.ref.update({
                status: 'sent',
                successCount: successCount,
                failureCount: failureCount,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Limpiar tokens inválidos de la base de datos
            if (failedTokens.length > 0) {
                console.log(`🧹 Limpiando ${failedTokens.length} tokens inválidos...`);
                
                const db = admin.firestore();
                const batch = db.batch();
                
                for (const token of failedTokens) {
                    const subscriptions = await db.collection('subscriptions')
                        .where('token', '==', token)
                        .get();
                    
                    subscriptions.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                }
                
                await batch.commit();
                console.log('✅ Tokens inválidos eliminados');
            }
            
            return {
                success: true,
                successCount,
                failureCount
            };
            
        } catch (error) {
            console.error('❌ Error al procesar notificación:', error);
            
            await snap.ref.update({
                status: 'failed',
                error: error.message,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    });

/**
 * Función de limpieza periódica (opcional)
 * Elimina notificaciones antiguas y tokens inválidos
 */
exports.cleanupOldNotifications = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        console.log('🧹 Iniciando limpieza de notificaciones antiguas...');
        
        const db = admin.firestore();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            const oldNotifications = await db.collection('notifications')
                .where('processedAt', '<', thirtyDaysAgo)
                .get();
            
            const batch = db.batch();
            oldNotifications.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log(`✅ ${oldNotifications.size} notificaciones antiguas eliminadas`);
            
        } catch (error) {
            console.error('❌ Error en limpieza:', error);
        }
        
        return null;
    });
