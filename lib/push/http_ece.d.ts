// Minimal types for the test-only dependency http_ece (RFC 8188).
declare module "http_ece" {
  const ece: {
    decrypt(
      buffer: Buffer,
      params: { version: "aes128gcm"; privateKey: unknown; authSecret: Buffer },
    ): Buffer;
  };
  export default ece;
}
