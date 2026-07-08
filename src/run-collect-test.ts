import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import "dotenv/config";

function usage(): never {
  console.error(
    "Usage: npm run test:collect -- [owner/repo] [pullNumber] [includeResolvedReplies=true|false]",
  );
  console.error(
    "Or set TEST_REPOSITORY and TEST_PULL_NUMBER in environment variables.",
  );
  process.exit(1);
}

function toEnvRecord(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const repository = process.argv[2] ?? process.env.TEST_REPOSITORY;
  const pullNumberRaw = process.argv[3] ?? process.env.TEST_PULL_NUMBER;
  const includeResolvedRepliesRaw = process.argv[4];

  if (!repository || !pullNumberRaw) {
    usage();
  }

  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is required for private repository access");
  }

  const pullNumber = Number(pullNumberRaw);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    throw new Error("pullNumber must be a positive integer");
  }

  const includeResolvedReplies =
    includeResolvedRepliesRaw === undefined
      ? process.env.TEST_INCLUDE_RESOLVED_REPLIES?.toLowerCase() !== "false"
      : includeResolvedRepliesRaw.toLowerCase() !== "false";

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    cwd: process.cwd(),
    env: toEnvRecord(process.env),
    stderr: "inherit",
  });

  const client = new Client(
    { name: "local-collect-tester", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "collect_pr_feedback",
      arguments: {
        repository,
        pullNumber,
        includeResolvedReplies,
      },
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await transport.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:collect] ${message}`);
  process.exit(1);
});
