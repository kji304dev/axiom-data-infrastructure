export const DEFAULT_PROFILE = "aec";
export const SUPPORTED_PROFILES = ["aec"] as const;

export type DataProfile = (typeof SUPPORTED_PROFILES)[number];

export function isSupportedProfile(value: string): value is DataProfile {
  return (SUPPORTED_PROFILES as readonly string[]).includes(value);
}

export function parseProfile(value: string): DataProfile {
  if (!isSupportedProfile(value)) {
    throw new Error(
      `Unsupported profile: ${value}\nSupported profiles: ${SUPPORTED_PROFILES.join(", ")}`,
    );
  }

  return value;
}
