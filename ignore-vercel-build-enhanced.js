import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Get current app name from package.json (what Turbo uses)
function getCurrentAppName() {
  try {
    const packageJsonPath = join(process.cwd(), "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      return packageJson.name;
    }
  } catch (error) {
    console.log("⚠️  Could not read package.json, falling back to APP_NAME");
  }

  // Fallback to environment variable
  return process.env.APP_NAME;
}

const branchName =
  process.env.VERCEL_GIT_COMMIT_REF ||
  execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
const currentAppName = getCurrentAppName();
const homepageAppName = "jazz-homepage";

// Helper function to execute git commands safely
function gitCommand(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch (error) {
    console.log(`Git command failed: ${command}`);
    return "";
  }
}

// Helper function to check if a git commit exists
function commitExists(sha) {
  if (!sha) return false;

  try {
    execSync(`git cat-file -e ${sha}`, { encoding: "utf8" });
    return true;
  } catch (error) {
    console.log(`⚠️  Commit ${sha} does not exist in repository`);
    return false;
  }
}

// Helper function to check if a branch/reference exists
function refExists(ref) {
  if (!ref) return false;

  try {
    execSync(`git show-ref --verify refs/heads/${ref}`, { encoding: "utf8" });
    return true;
  } catch (error) {
    console.log(`⚠️  Branch/ref ${ref} does not exist in repository`);
    return false;
  }
}

// Check if Turbo would run any tasks for this app based on changes
function turboHasChanges(currentAppName) {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;

  try {
    let filterCommand;

    if (previousSha && commitExists(previousSha)) {
      // Check changes since last deployment - commit exists
      console.log(`🎯 Using previous SHA: ${previousSha}`);
      filterCommand = `pnpm turbo run build --filter=${currentAppName}...[${previousSha}] --dry-run`;
    } else {
      // Check if main branch exists, otherwise use HEAD~1 or fall back to building
      // Note: Vercel does shallow clones, so 'main' branch may not be available
      if (refExists("main")) {
        console.log(`🎯 Using main branch as fallback`);
        filterCommand = `pnpm turbo run build --filter=${currentAppName}...[main] --dry-run`;
      } else {
        // Try HEAD~1 as fallback (previous commit)
        console.log(
          `⚠️  Main branch not available (likely Vercel shallow clone), trying HEAD~1 as fallback`,
        );
        try {
          execSync(`git rev-parse HEAD~1`, { encoding: "utf8" });
          filterCommand = `pnpm turbo run build --filter=${currentAppName}...[HEAD~1] --dry-run`;
        } catch (error) {
          console.log(`⚠️  HEAD~1 also not available, will build for safety`);
          return null; // Will trigger build for safety
        }
      }
    }

    console.log(`🎯 Running: ${filterCommand}`);
    const result = gitCommand(filterCommand);

    if (result) {
      // If turbo finds tasks to run, there are relevant changes
      const hasTasksToRun =
        result.includes(currentAppName) || result.includes("run build");
      console.log(
        `🎯 Turbo change detection: ${hasTasksToRun ? "changes detected" : "no changes"}`,
      );
      return hasTasksToRun;
    }
  } catch (error) {
    console.log(`⚠️  Turbo change detection failed: ${error.message}`);
  }

  return null; // Unknown, will build for safety
}

// Main logic
console.log(
  `🔍 Checking build necessity for ${currentAppName} on branch ${branchName}`,
);

// Special docs branch logic
if (
  branchName === "main" &&
  process.env.VERCEL_GIT_COMMIT_MESSAGE?.includes("docs")
) {
  if (currentAppName === homepageAppName) {
    console.log(
      '✅ Building homepage because a "docs" branch was merged into "main".',
    );
    process.exit(1);
  } else {
    console.log(
      `🛑 Skipping build for ${currentAppName} after \"docs\" branch merged to main.`,
    );
    process.exit(0);
  }
} else if (branchName.includes("docs")) {
  if (currentAppName === homepageAppName) {
    console.log('✅ Building homepage for "docs" branch.');
    process.exit(1);
  } else {
    console.log(`🛑 Skipping build for ${currentAppName} on \"docs\" branch.`);
    process.exit(0);
  }
}

// Use Turbo to determine if build is needed
console.log("🎯 Checking with Turbo...");
const turboChanges = turboHasChanges(currentAppName);

if (turboChanges === true) {
  console.log(
    `✅ Building ${currentAppName} - Turbo detected relevant changes.`,
  );
  process.exit(1);
} else if (turboChanges === false) {
  console.log(
    `🛑 Skipping build for ${currentAppName} - Turbo found no relevant changes.`,
  );
  process.exit(0);
} else {
  // Turbo failed, build for safety
  console.log(
    `✅ Building ${currentAppName} - Turbo check failed, proceeding for safety.`,
  );
  process.exit(1);
}
