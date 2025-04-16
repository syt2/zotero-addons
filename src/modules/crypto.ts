export const Base64Utils = {
  toArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = Zotero.getMainWindow().atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  },

  fromArrayBuffer(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Zotero.getMainWindow().btoa(binary);
  },

  encode(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return this.fromArrayBuffer(bytes.buffer as ArrayBuffer);
  },

  decode(base64Str: string): string {
    const bytes = new Uint8Array(this.toArrayBuffer(base64Str));
    return new TextDecoder().decode(bytes);
  }
};

export async function importKey(pemKey: string, isPrivate: boolean): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(`-----BEGIN ${isPrivate ? 'PRIVATE' : 'PUBLIC'} KEY-----`, "")
    .replace(`-----END ${isPrivate ? 'PRIVATE' : 'PUBLIC'} KEY-----`, "")
    .replace(/\n/g, "");

  const binaryDer = Base64Utils.toArrayBuffer(pemContents);

  return await Zotero.getMainWindow().crypto.subtle.importKey(
    isPrivate ? "pkcs8" : "spki",
    binaryDer,
    {
      name: "RSA-PSS",
      hash: "SHA-256"
    },
    true,
    [isPrivate ? "sign" : "verify"]
  );
}

export async function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const signatureBuffer = Base64Utils.toArrayBuffer(signature);
    const dataBuffer = Base64Utils.toArrayBuffer(data);

    const key = await importKey(publicKey, false);
    return await Zotero.getMainWindow().crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: 64
      },
      key,
      signatureBuffer,
      dataBuffer
    );
  } catch (e) {
    ztoolkit.log("签名验证失败:", e);
    return false;
  }
}

export const encryptExecJsCommand = async (source: string, privateKey: string) => {
  const jsSource = Base64Utils.encode(source);
  const dataBuffer = Base64Utils.toArrayBuffer(jsSource);

  const key = await importKey(privateKey, true);
  const signature = await Zotero.getMainWindow().crypto.subtle.sign(
    {
      name: "RSA-PSS",
      saltLength: 64
    },
    key,
    dataBuffer
  );

  const signatureBase64 = Base64Utils.fromArrayBuffer(signature);
  return `zotero://zoteroaddoncollection/execJS?source=${encodeURIComponent(jsSource)}&sign=${encodeURIComponent(signatureBase64)}`;
}

export const publicKeyBase64 = 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQ0lqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FnOEFNSUlDQ2dLQ0FnRUE0VzdsWWxpSTBjQnh0c3pzWXBMVApraUY3YkxxWk5CWlVzempJYkVsWXRZM1ViRGhmSVd4QzNJSEhKUFpmdlN4R0ZhUEZEbkxPK0JIS3J3NVhPaU05CmsvYWdTbm8xK3hVREdlZEU2Q3MwOXpEWExDYUhjampOeG82eEZsZ0NUN0NLRnR3aXM5RWdDN2NrYUltUnYrNlEKc1hsUWlNL0NMVzZ0eFVodFBqOTJWbGM1Q2IvTFZqU1hUNFZ1dkNuaXM1Vi81K0VhMHZlQ2FVRDljQVEydXFXWgowaDI1ZUZzZGRBa1FKVDRnQ2U3R1hHS3hMc0FUV0NiSkNsaDJWQXMvR1doMUhMUUQ5b1lPczh5b2JKM1pxTDlQCmZ5TUFUTlQycFdhVXp0Zkx2UDN3MGRQdTdHbU9QNjl2Yk9VWXVCSXFDYUU2UFp6TWhjSEtCa3BYSktaYjFIaTUKZjdwOGF1TFFhOHdSbXVUSE9XSzdVTlY5Q04xNkpMVmhoMENvVmdRMUI1aDhxZUZyQlUzN1BUQkt0ajQ4RFVNdwovQmM1cjg5RnVhcnB0ckR5Y2EyTW9XNXhKMUd1THBBendiWTZEWFNwQWh3TVBxT2dvV2JzZXh6L2xyZzhNNVVxCi9SZmtjeVovbE9oaFR2S0VoU2dWS09ocHdkSjBQK3BVVm8weFF0QXRCMmQ3RkM0WGNkMmwvcVFFb05kSjF6Z20KY0dmQThZTGVodGl1VGsyZm9TQ2hMZVJsMnhqa05nZERJMkhwTHc3NzFxOTdPUUswWUVkVEVWd3IyK2tJaUJsUgpVOCtZNUgxb3RDdGdrRUx1M0hsbjdLZmg3QlBMeEU5Tkh5Z2gyK29GMUVLVmhHdDYwc1ArbVVHenpVQjNIcjdFCm9kNVFoRnJ4SGRlc0dPQ0cwTzRqMFBFQ0F3RUFBUT09Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ=='