import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool =  mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  timezone: '-05:00', // 🇪🇨 Ecuador
});

export default pool;

/*
 * ============================================================
 * SCRIPT DE CREACIÓN DE BASE DE DATOS
 * ============================================================

CREATE DATABASE IF NOT EXISTS BD_SanJose;
USE BD_SanJose;

-- ── ÁREAS ────────────────────────────────────────────────────
CREATE TABLE areas (
  id_area     INT          NOT NULL AUTO_INCREMENT,
  nombre_area VARCHAR(30)  NOT NULL,
  PRIMARY KEY (id_area),
  UNIQUE KEY (nombre_area)
);

INSERT INTO areas VALUES (1,'secretaria'), (2,'colecturia');

-- ── ROLES ─────────────────────────────────────────────────────
CREATE TABLE roles (
  id_rol     INT         NOT NULL AUTO_INCREMENT,
  nombre_rol VARCHAR(20) NOT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY (nombre_rol)
);

INSERT INTO roles VALUES
  (1,'secretaria'),
  (2,'docente'),
  (3,'colecturia'),
  (4,'administrador');

-- ── PERSONAS ──────────────────────────────────────────────────
CREATE TABLE personas (
  cedula   VARCHAR(10) NOT NULL,
  nombre   VARCHAR(20) DEFAULT NULL,
  apellido VARCHAR(20) DEFAULT NULL,
  correo   VARCHAR(50) DEFAULT NULL,
  telefono VARCHAR(10) DEFAULT NULL,
  PRIMARY KEY (cedula)
);

INSERT INTO personas VALUES
  ('0957333255', 'Anthony Josue', 'Villamar Indio', 'anthonyvillamar3000@gmail.com', '0991494742');

-- ── USUARIOS ──────────────────────────────────────────────────
CREATE TABLE usuarios (
  id_usuario INT         NOT NULL AUTO_INCREMENT,
  cedula     VARCHAR(10) NOT NULL,
  usuario    VARCHAR(20) NOT NULL,
  contrasena VARCHAR(90) NOT NULL,
  id_rol     INT         NOT NULL,
  estado     ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  PRIMARY KEY (id_usuario),
  UNIQUE KEY (usuario),
  FOREIGN KEY (cedula)  REFERENCES personas (cedula),
  FOREIGN KEY (id_rol)  REFERENCES roles    (id_rol)
);

-- Contraseña: 0957333255a (hash bcrypt)
INSERT INTO usuarios (cedula, usuario, contrasena, id_rol, estado) VALUES
  ('0957333255', 'anjovin', '$2b$10$SlP4iVUJpE0e2Yb.cNUTTuXSkKcPt9PcLqtMgUs8s02clSFicm/Ee', 4, 'activo');

-- ── MOTIVOS DE CALIFICACIÓN ───────────────────────────────────
CREATE TABLE motivos_calificacion (
  id_motivo     INT          NOT NULL AUTO_INCREMENT,
  nombre_motivo VARCHAR(150) NOT NULL,
  id_area       INT          NOT NULL,
  PRIMARY KEY (id_motivo),
  UNIQUE KEY (nombre_motivo, id_area),
  FOREIGN KEY (id_area) REFERENCES areas (id_area)
);

INSERT INTO motivos_calificacion (id_motivo, nombre_motivo, id_area) VALUES
  (1,  'Cita con la Señora Rectora por pensiones',               1),
  (2,  'Solicitud de Informes de Aprendizajes',                  1),
  (3,  'Solicitud de documentos académicos (duplicados)',         1),
  (4,  'Solicitud de Certificados varios',                        1),
  (5,  'Entrega de Certificado de Promoción',                     1),
  (6,  'Soporte al Sistema Runachay',                             1),
  (7,  'Cambio de datos del estudiante/representante en Runachay',1),
  (8,  'Solicitud de retiro del estudiante',                      1),
  (9,  'Entrega de expediente completo del estudiante',           1),
  (10, 'Información de matrícula',                                1),
  (11, 'Información sobre admisiones',                            1),
  (12, 'Información del Curso Vacacional "San José divertido"',   1),
  (13, 'Información del Curso "Tareas al día"',                   1),
  (14, 'Información de Curso de Nivelación',                      1),
  (15, 'Otros',                                                   1),
  (16, 'Cita con la Señora Rectora por pensiones',               2),
  (17, 'Consulta sobre deuda pendiente',                          2),
  (18, 'Cancelar valor de pensiones',                             2),
  (19, 'Ayuda para subir comprobante a la Plataforma',            2),
  (20, 'Soporte por Plataforma bloqueada',                        2),
  (21, 'Información sobre admisiones',                            2),
  (22, 'Información del Curso Vacacional "San José Divertido"',   2),
  (23, 'Información del Curso "Tareas al día"',                   2),
  (24, 'Información del Curso de Nivelación',                     2),
  (25, 'Información sobre valores ofrecidos por la Unidad Educativa', 2),
  (26, 'Otros',                                                   2);

-- ── CALIFICACIONES ────────────────────────────────────────────
CREATE TABLE calificaciones (
  id_calificacion INT      NOT NULL AUTO_INCREMENT,
  cedula_usuario  VARCHAR(10) NOT NULL,
  area_atencion   INT      NOT NULL,
  fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  puntualidad     TINYINT  DEFAULT NULL,
  trato           TINYINT  DEFAULT NULL,
  resolucion      TINYINT  DEFAULT NULL,
  comentario      TEXT,
  id_motivo       INT      NOT NULL,
  PRIMARY KEY (id_calificacion),
  FOREIGN KEY (cedula_usuario) REFERENCES personas          (cedula)    ON DELETE CASCADE,
  FOREIGN KEY (id_motivo)      REFERENCES motivos_calificacion (id_motivo),
  FOREIGN KEY (area_atencion)  REFERENCES areas              (id_area),
  CONSTRAINT chk_puntualidad CHECK (puntualidad BETWEEN 1 AND 3),
  CONSTRAINT chk_trato       CHECK (trato       BETWEEN 1 AND 3),
  CONSTRAINT chk_resolucion  CHECK (resolucion  BETWEEN 1 AND 3)
);

 * ============================================================
 */