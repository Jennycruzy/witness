// Merged pull requests that close an issue, and published GitHub releases (through the gh CLI).
import { execFileSync } from 'node:child_process';

export interface FixPR {
  number: number; title: string; body: string; mergedAt: string; mergeSha: string; files: string[];
  issues: { number: number; title: string; body: string; labels: string[] }[];
}

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });

const Q = `query($q:String!,$after:String){search(query:$q,type:ISSUE,first:40,after:$after){pageInfo{hasNextPage endCursor}
 nodes{... on PullRequest{number title body mergedAt mergeCommit{oid} files(first:100){nodes{path}}
 closingIssuesReferences(first:3){nodes{number title body labels(first:10){nodes{name}}}}}}}}`;

/** Merged PRs in `repo` between two dates (YYYY-MM-DD) that close at least one issue. */
export function listFixPRs(repo: string, since: string, until: string, max = 300): FixPR[] {
  const out: FixPR[] = [];
  let after: string | null = null;
  const q = `repo:${repo} is:pr is:merged linked:issue merged:${since}..${until} sort:created-desc`;
  while (out.length < max) {
    const args = ['api', 'graphql', '-f', `query=${Q}`, '-f', `q=${q}`];
    if (after) args.push('-f', `after=${after}`);
    const j = JSON.parse(gh(args)).data.search;
    for (const n of j.nodes) {
      if (!n?.number) continue;
      out.push({
        number: n.number, title: n.title, body: n.body ?? '', mergedAt: n.mergedAt, mergeSha: n.mergeCommit?.oid ?? '',
        files: n.files?.nodes?.map((f: any) => f.path) ?? [],
        issues: n.closingIssuesReferences.nodes.map((i: any) => ({ number: i.number, title: i.title, body: i.body ?? '', labels: i.labels.nodes.map((l: any) => l.name) })),
      });
    }
    if (!j.pageInfo.hasNextPage) break;
    after = j.pageInfo.endCursor;
  }
  return out;
}

export interface Release { tag: string; publishedAt: string; assets: { name: string; url: string }[]; }

export function listReleases(repo: string): Release[] {
  const pages = gh(['api', '--paginate', `repos/${repo}/releases?per_page=100`, '--jq', '.[] | select(.draft|not) | {tag: .tag_name, publishedAt: .published_at, assets: [.assets[] | {name, url: .browser_download_url}]}']);
  return pages.trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).sort((a: Release, b: Release) => a.publishedAt.localeCompare(b.publishedAt));
}

/** True when commit `sha` is part of `tag` (the tag is the commit itself or comes after it). */
export function tagContains(repo: string, tag: string, sha: string): boolean {
  const s = gh(['api', `repos/${repo}/compare/${encodeURIComponent(tag)}...${sha}`, '--jq', '.status']).trim();
  return s === 'identical' || s === 'behind';
}
