export interface KeyVersion {
  readonly version: string
  readonly createdAt: Date
  readonly deactivatedAt?: Date
}
