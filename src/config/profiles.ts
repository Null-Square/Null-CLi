import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface ModelProfile {
  name: string;
  model: string;
  baseUrl?: string;
  updatedAt: string;
}

interface ProfileStore {
  version: 1;
  activeProfile?: string;
  profiles: ModelProfile[];
}

interface EncryptedSecret {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface CredentialStore {
  version: 1;
  entries: Record<string, EncryptedSecret>;
}

export interface ResolvedModelProfile extends ModelProfile {
  apiKey?: string;
}

const emptyProfiles = (): ProfileStore => ({ version: 1, profiles: [] });
const emptyCredentials = (): CredentialStore => ({ version: 1, entries: {} });

export const configHome = (): string =>
  path.resolve(process.env.NULL_AI_HOME ?? path.join(os.homedir(), ".null-ai"));

export const profileStorePath = (): string => path.join(configHome(), "profiles.json");
export const credentialStorePath = (): string => path.join(configHome(), "credentials.json");
export const masterKeyPath = (): string => path.join(configHome(), "master.key");

const readJsonOr = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const writePrivateFile = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(filePath, 0o600).catch(() => undefined);
};

const loadMasterKey = async (): Promise<Buffer> => {
  try {
    const encoded = (await fs.readFile(masterKeyPath(), "utf8")).trim();
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("invalid key length");
    return key;
  } catch {
    const key = crypto.randomBytes(32);
    await writePrivateFile(masterKeyPath(), `${key.toString("base64")}\n`);
    return key;
  }
};

const encrypt = async (value: string): Promise<EncryptedSecret> => {
  const key = await loadMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
};

const decrypt = async (secret: EncryptedSecret): Promise<string> => {
  const key = await loadMasterKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export const listModelProfiles = async (): Promise<ModelProfile[]> => {
  const store = await readJsonOr(profileStorePath(), emptyProfiles());
  return store.profiles;
};

export const activeProfileName = async (): Promise<string | undefined> => {
  const store = await readJsonOr(profileStorePath(), emptyProfiles());
  return store.activeProfile;
};

export const loadModelProfile = async (name?: string): Promise<ResolvedModelProfile | null> => {
  const profiles = await readJsonOr(profileStorePath(), emptyProfiles());
  const selectedName = name ?? profiles.activeProfile;
  if (!selectedName) return null;
  const profile = profiles.profiles.find((item) => item.name === selectedName);
  if (!profile) return null;

  const credentials = await readJsonOr(credentialStorePath(), emptyCredentials());
  const encrypted = credentials.entries[selectedName];
  let apiKey: string | undefined;
  if (encrypted) {
    try {
      apiKey = await decrypt(encrypted);
    } catch {
      throw new Error(`Could not unlock credentials for profile "${selectedName}". Reconfigure the profile.`);
    }
  }
  return { ...profile, apiKey };
};

export const saveModelProfile = async (
  input: { name: string; model: string; baseUrl?: string; apiKey?: string },
): Promise<ResolvedModelProfile> => {
  const name = input.name.trim();
  const model = input.model.trim();
  if (!name) throw new Error("Profile name is required.");
  if (!model) throw new Error("Model id is required.");

  const profiles = await readJsonOr(profileStorePath(), emptyProfiles());
  const profile: ModelProfile = {
    name,
    model,
    baseUrl: input.baseUrl?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  const existing = profiles.profiles.findIndex((item) => item.name === name);
  if (existing >= 0) profiles.profiles[existing] = profile;
  else profiles.profiles.push(profile);
  profiles.activeProfile = name;
  await writePrivateFile(profileStorePath(), `${JSON.stringify(profiles, null, 2)}\n`);

  if (input.apiKey) {
    const credentials = await readJsonOr(credentialStorePath(), emptyCredentials());
    credentials.entries[name] = await encrypt(input.apiKey);
    await writePrivateFile(credentialStorePath(), `${JSON.stringify(credentials, null, 2)}\n`);
  }

  return loadModelProfile(name) as Promise<ResolvedModelProfile>;
};

export const activateModelProfile = async (name: string): Promise<ResolvedModelProfile> => {
  const profiles = await readJsonOr(profileStorePath(), emptyProfiles());
  if (!profiles.profiles.some((profile) => profile.name === name)) {
    throw new Error(`Unknown model profile "${name}".`);
  }
  profiles.activeProfile = name;
  await writePrivateFile(profileStorePath(), `${JSON.stringify(profiles, null, 2)}\n`);
  return loadModelProfile(name) as Promise<ResolvedModelProfile>;
};

export const deleteModelProfile = async (name: string): Promise<void> => {
  const profiles = await readJsonOr(profileStorePath(), emptyProfiles());
  profiles.profiles = profiles.profiles.filter((profile) => profile.name !== name);
  if (profiles.activeProfile === name) profiles.activeProfile = profiles.profiles[0]?.name;
  await writePrivateFile(profileStorePath(), `${JSON.stringify(profiles, null, 2)}\n`);

  const credentials = await readJsonOr(credentialStorePath(), emptyCredentials());
  delete credentials.entries[name];
  await writePrivateFile(credentialStorePath(), `${JSON.stringify(credentials, null, 2)}\n`);
};
