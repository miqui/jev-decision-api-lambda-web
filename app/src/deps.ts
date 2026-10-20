import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { KeyLookup } from './auth.ts';

export function dynamoKeyLookup(tableName: string, client = new DynamoDBClient({})): KeyLookup {
  return async (keyHash) => {
    const out = await client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { key_hash: { S: keyHash } },
        ConsistentRead: false,
      }),
    );
    const item = out.Item;
    if (!item?.key_hash?.S) return null;
    return { keyHash: item.key_hash.S, active: item.active?.BOOL === true };
  };
}

/** Reads the secret once and caches the promise; a failed read is not cached. */
export function cachedSecret(secretId: string, client = new SecretsManagerClient({})) {
  let cached: Promise<string> | undefined;
  return (): Promise<string> => {
    cached ??= client
      .send(new GetSecretValueCommand({ SecretId: secretId }))
      .then((r) => {
        if (!r.SecretString) throw new Error('empty secret');
        return r.SecretString.trim();
      })
      .catch((e: unknown) => {
        cached = undefined;
        throw e;
      });
    return cached;
  };
}
