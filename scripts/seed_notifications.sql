-- seed example
INSERT INTO notification_subscriptions (user_id, channel, address, levels) VALUES (NULL,'email','tu@correo.com', ARRAY['critical','warning']) ON CONFLICT DO NOTHING;