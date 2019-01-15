import { EthPmResolver } from "../../../src/solidity";

const data = [
  ["zeppelin/contract.sol", { cwd: "/eth" }, "/eth/contracts/zeppelin/contract.sol"],
  ["zeppelin/contract.sol", { cwd: "/" }, null],
  ["zeppelin/contract.sol", { cwd: "/eth/contracts" }, "/eth/contracts/zeppelin/contract.sol"],
  ["zeppelin/contract.sol", { cwd: "/eth/someproject" }, "/eth/contracts/zeppelin/contract.sol"],
  ["zeppelin/contract.sol", { cwd: "/path/to" }, null],
  ["ledzeppelin/othercontract.sol", { cwd: "/eth" }, "/eth/installed_contracts/ledzeppelin/othercontract.sol"],
  ["ledzeppelin/othercontract.sol", { cwd: "/" }, null],
  [
    "ledzeppelin/othercontract.sol",
    { cwd: "/eth/installed_contracts" },
    "/eth/installed_contracts/ledzeppelin/othercontract.sol",
  ],
  [
    "ledzeppelin/othercontract.sol",
    { cwd: "/eth/someproject" },
    "/eth/installed_contracts/ledzeppelin/othercontract.sol",
  ],
  ["ledzeppelin/othercontract.sol", { cwd: "/path/to" }, null],
  ["to/file.txt", { cwd: "/" }, null],
  ["to/file.txt", { cwd: "/path" }, null],
  ["to/file.txt", { cwd: "/eth" }, null],
  ["to/file.txt", { cwd: "/eth/contracts" }, null],
  ["to/file.txt", { cwd: "/eth/installed_contracts" }, null],
];

describe("EthPmResolver", () => {
  const subject = EthPmResolver();

  it.each(data)("testing %o", async (input, context, output) => {
    const actualOutput = await subject(input, context);
    expect(actualOutput).toBe(output);

    // IMPLEMENT ME
  });
});
