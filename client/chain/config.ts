/** Where the ranked client finds the lives contract, the NEAR RPC and the life verifier. Testnet only. */
export interface ChainConfig {
  contractId: string;
  rpcUrl: string;
  networkId: "testnet";
  verifyUrl: string;
}

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  contractId: "everfolk-lives-demo.testnet",
  rpcUrl: "https://test.rpc.fastnear.com",
  networkId: "testnet",
  verifyUrl: "/api/ranked/verify",
};

type Env = Record<string, string | undefined>;

const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

function viteEnv(): Env {
  // `import.meta.env` exists under Vite only; Node tests and the worker fall back to defaults.
  return (import.meta as ImportMeta & { env?: Env }).env ?? {};
}

function pick(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback;
}

/** Defaults, then `VITE_EVERFOLK_*` build variables, then explicit overrides. */
export function resolveChainConfig(overrides: Partial<Omit<ChainConfig, "networkId">> = {}, env: Env = viteEnv()): ChainConfig {
  const config: ChainConfig = {
    networkId: "testnet",
    contractId: pick(overrides.contractId, pick(env.VITE_EVERFOLK_CONTRACT_ID, DEFAULT_CHAIN_CONFIG.contractId)),
    rpcUrl: pick(overrides.rpcUrl, pick(env.VITE_EVERFOLK_RPC_URL, DEFAULT_CHAIN_CONFIG.rpcUrl)),
    verifyUrl: pick(overrides.verifyUrl, pick(env.VITE_EVERFOLK_VERIFY_URL, DEFAULT_CHAIN_CONFIG.verifyUrl)),
  };
  if (!ACCOUNT_ID.test(config.contractId)) throw new Error(`"${config.contractId}" is not a valid NEAR contract account.`);
  if (!/^https?:\/\//.test(config.rpcUrl)) throw new Error(`The NEAR RPC URL must be http(s), got "${config.rpcUrl}".`);
  return config;
}
