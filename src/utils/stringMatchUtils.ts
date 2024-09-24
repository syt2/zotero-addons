export class StringMatchUtils {
  // TODO: upgrade match algorithm
  static checkMatch(pattern: string, content: string): boolean {
    const lcs = this.longestCommonSubsequence(pattern, content);
    if (lcs.length < Math.min(pattern.length, content.length) * 0.6) { return false; }
    if (lcs.length >= Math.max(pattern.length, content.length) * 1.2) { return false; }
    const minWindow = this.minWindow(content, lcs);
    ztoolkit.log(lcs, content, minWindow);
    return minWindow != null && minWindow[1] < lcs.length * 1.3;
  }

  static longestCommonSubsequence(text1: string, text2: string): string {
    const m = text1.length;
    const n = text2.length;

    const dp: number[][] = new Array(m + 1);
    for (let i = 0; i <= m; i++) {
      dp[i] = new Array(n + 1).fill(0);
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text1[i - 1] === text2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m, j = n;
    const lcs: string[] = [];
    while (i > 0 && j > 0) {
      if (text1[i - 1] === text2[j - 1]) {
        lcs.unshift(text1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs.join("");
  }

  static minWindow(s: string, t: string): [number, number] | null {
    const m = s.length, n = t.length
    let start = -1, minLen = Number.MAX_SAFE_INTEGER, i = 0, j = 0, end;
    while (i < m) {
      if (s[i] == t[j]) {
        if (++j == n) {
          end = i + 1;
          while (--j >= 0) {
            while (s[i--] != t[j]);
          }
          ++i; ++j;
          if (end - i < minLen) {
            minLen = end - i;
            start = i;
          }
        }
      }
      ++i;
    }
    return start == -1 ? null : [start, minLen];
  }
}

