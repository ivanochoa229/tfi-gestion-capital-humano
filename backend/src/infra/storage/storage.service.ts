import { Readable } from 'node:stream';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Env } from '../config/env.validation.js';

/**
 * Acceso al almacenamiento de objetos (RustFS en local, compatible con S3).
 * Guarda los archivos de los activos de conocimiento; la base solo guarda
 * la clave del objeto y sus metadatos (RNF08).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.cliente = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      // RustFS expone los buckets como ruta (http://host:9000/bucket/clave).
      forcePathStyle: true,
    });
  }

  /** Crea el bucket la primera vez que se levanta el entorno. */
  async onModuleInit(): Promise<void> {
    if (await this.disponible()) return;
    try {
      await this.cliente.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" creado`);
    } catch (error) {
      this.logger.warn(
        `No se pudo crear el bucket "${this.bucket}": ${(error as Error).message}`,
      );
    }
  }

  async disponible(): Promise<boolean> {
    try {
      await this.cliente.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  async subir(
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: contenido,
        ContentType: tipoMime,
      }),
    );
  }

  async obtener(clave: string): Promise<Readable> {
    const respuesta = await this.cliente.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: clave }),
    );
    return respuesta.Body as Readable;
  }

  async eliminar(clave: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }),
    );
  }
}
