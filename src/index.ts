import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import "dotenv/config";

type RepoRef = {
  owner: string;
  repo: string;
};

const server = new McpServer({
  name: "github-pr-review-mcp",
  version: "0.1.0",
});

function parseRepo(input: string): RepoRef {
  const [owner, repo, ...rest] = input.split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error("repository must be in 'owner/repo' format");
  }
  return { owner, repo };
}

function buildOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const baseUrl = process.env.GITHUB_API_BASE_URL;
  return new Octokit({
    auth: token,
    baseUrl,
  });
}

function asText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const sharedSchema = {
  repository: z.string().describe("GitHub repository in owner/repo format"),
  pullNumber: z.number().int().positive().describe("Pull request number"),
};

server.tool(
  "collect_pr_feedback",
  "Collect PR review comments, issue comments, and review summaries for a PR.",
  {
    ...sharedSchema,
    includeResolvedReplies: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include reply comments in the review comment list"),
  },
  async ({ repository, pullNumber, includeResolvedReplies }) => {
    const octokit = buildOctokit();
    const { owner, repo } = parseRepo(repository);

    const [pr, issueComments, reviewComments, reviews] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
      octokit.paginate(octokit.issues.listComments, {
        owner,
        repo,
        issue_number: pullNumber,
        per_page: 100,
      }),
      octokit.paginate(octokit.pulls.listReviewComments, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
      octokit.paginate(octokit.pulls.listReviews, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
    ]);

    const repliedIds = new Set<number>();
    for (const comment of reviewComments) {
      if (comment.in_reply_to_id) {
        repliedIds.add(comment.in_reply_to_id);
      }
    }

    const topLevelReviewComments = reviewComments.filter(
      (c) => !c.in_reply_to_id,
    );

    const unansweredReviewComments = topLevelReviewComments.filter(
      (c) => !repliedIds.has(c.id),
    );

    const filteredReviewComments = includeResolvedReplies
      ? reviewComments
      : topLevelReviewComments;

    const result = {
      pullRequest: {
        number: pr.data.number,
        title: pr.data.title,
        state: pr.data.state,
        draft: pr.data.draft,
        author: pr.data.user?.login,
        headRef: pr.data.head.ref,
        baseRef: pr.data.base.ref,
        htmlUrl: pr.data.html_url,
        createdAt: pr.data.created_at,
        updatedAt: pr.data.updated_at,
      },
      summary: {
        issueCommentsCount: issueComments.length,
        reviewCommentsCount: reviewComments.length,
        topLevelReviewCommentsCount: topLevelReviewComments.length,
        unansweredReviewCommentsCount: unansweredReviewComments.length,
        reviewsCount: reviews.length,
      },
      issueComments: issueComments.map((c) => ({
        id: c.id,
        user: c.user?.login,
        body: c.body ?? "",
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        htmlUrl: c.html_url,
      })),
      reviewComments: filteredReviewComments.map((c) => ({
        id: c.id,
        pullRequestReviewId: c.pull_request_review_id,
        inReplyToId: c.in_reply_to_id,
        user: c.user?.login,
        path: c.path,
        line: c.line,
        originalLine: c.original_line,
        side: c.side,
        body: c.body,
        diffHunk: c.diff_hunk,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        htmlUrl: c.html_url,
      })),
      unansweredReviewComments: unansweredReviewComments.map((c) => ({
        id: c.id,
        user: c.user?.login,
        path: c.path,
        line: c.line,
        body: c.body,
        createdAt: c.created_at,
        htmlUrl: c.html_url,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        user: r.user?.login,
        state: r.state,
        body: r.body,
        submittedAt: r.submitted_at,
        htmlUrl: r.html_url,
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: asText(result),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[github-pr-review-mcp] ${message}`);
  process.exit(1);
});
