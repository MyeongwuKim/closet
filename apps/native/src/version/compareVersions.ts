type ParsedVersion = {
  core: number[];
  prerelease: string[];
};

function parseVersion(value: string): ParsedVersion | null {
  const normalized = value.trim().replace(/^v/i, "").split("+")[0];
  const prereleaseSeparatorIndex = normalized.indexOf("-");
  const coreValue =
    prereleaseSeparatorIndex === -1
      ? normalized
      : normalized.slice(0, prereleaseSeparatorIndex);
  const prereleaseValue =
    prereleaseSeparatorIndex === -1
      ? ""
      : normalized.slice(prereleaseSeparatorIndex + 1);

  if (!/^\d+(?:\.\d+)*$/.test(coreValue)) {
    return null;
  }

  const prerelease = prereleaseValue ? prereleaseValue.split(".") : [];

  if (prerelease.some((part) => !/^[0-9A-Za-z-]+$/.test(part))) {
    return null;
  }

  return {
    core: coreValue.split(".").map((part) => Number.parseInt(part, 10)),
    prerelease
  };
}

function comparePrerelease(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }

  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    }

    if (leftPart === rightPart) {
      continue;
    }

    const leftIsNumber = /^\d+$/.test(leftPart);
    const rightIsNumber = /^\d+$/.test(rightPart);

    if (leftIsNumber && rightIsNumber) {
      return Number.parseInt(leftPart, 10) > Number.parseInt(rightPart, 10)
        ? 1
        : -1;
    }

    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? -1 : 1;
    }

    return leftPart > rightPart ? 1 : -1;
  }

  return 0;
}

export function compareVersions(leftValue: string, rightValue: string) {
  const left = parseVersion(leftValue);
  const right = parseVersion(rightValue);

  if (!left || !right) {
    return leftValue.localeCompare(rightValue, "en", {
      numeric: true,
      sensitivity: "base"
    });
  }

  const length = Math.max(left.core.length, right.core.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left.core[index] ?? 0;
    const rightPart = right.core[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return comparePrerelease(left.prerelease, right.prerelease);
}
