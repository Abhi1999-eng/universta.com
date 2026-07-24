CREATE DATABASE IF NOT EXISTS universta
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS universta_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'universta_app'@'localhost'
  IDENTIFIED BY 'UniverstaLocal_2026_ChangeMe';
CREATE USER IF NOT EXISTS 'universta_app'@'127.0.0.1'
  IDENTIFIED BY 'UniverstaLocal_2026_ChangeMe';

ALTER USER 'universta_app'@'localhost'
  IDENTIFIED BY 'UniverstaLocal_2026_ChangeMe';
ALTER USER 'universta_app'@'127.0.0.1'
  IDENTIFIED BY 'UniverstaLocal_2026_ChangeMe';

GRANT ALL PRIVILEGES ON universta.* TO 'universta_app'@'localhost';
GRANT ALL PRIVILEGES ON universta_shadow.* TO 'universta_app'@'localhost';
GRANT ALL PRIVILEGES ON universta.* TO 'universta_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON universta_shadow.* TO 'universta_app'@'127.0.0.1';
FLUSH PRIVILEGES;

SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME IN ('universta','universta_shadow');

SELECT user, host FROM mysql.user
WHERE user='universta_app' ORDER BY host;
