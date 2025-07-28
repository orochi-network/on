import { writeFileSync, readFileSync, existsSync } from "fs";
import { createInterface, Interface } from "readline/promises";
import { HDNodeWallet, Wallet } from "ethers";
import { Writable } from "stream";
import path from "path";

class InputConsole {
  private muted = false;

  private rl: Interface;

  private mutStdout: Writable;

  constructor() {
    this.mutStdout = new Writable({
      write: (chunk, encoding, callback) => {
        if (!this.muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });
    this.rl = createInterface({
      input: process.stdin,
      output: this.mutStdout,
      terminal: true,
    });
  }

  public async readPassPhrase(question: string) {
    this.muted = true;
    process.stdout.write(question);
    const password = await this.rl.question("");
    this.muted = false;
    return password;
  }

  public close() {
    this.rl.close();
  }
}

const KEY_FILE = `${path.resolve(".")}/info.log`;

export async function getEncryptWallet(): Promise<HDNodeWallet | Wallet> {
  const consoleInput = new InputConsole();

  if (!existsSync(KEY_FILE)) {
    const password = await consoleInput.readPassPhrase("Password: ");
    const retypePassword = await consoleInput.readPassPhrase("\nRetype: ");
    consoleInput.close();
    if (password !== retypePassword) {
      throw new Error("Password was not matched");
    }
    const wallet = Wallet.createRandom();
    process.stdout.write(`\n Create wallet: ${wallet.address}\n`);
    writeFileSync(KEY_FILE, wallet.encryptSync(password));
    return wallet;
  }
  const password = await consoleInput.readPassPhrase("Password: ");
  consoleInput.close();
  const wallet = Wallet.fromEncryptedJsonSync(
    readFileSync(KEY_FILE, "utf-8"),
    password
  );

  process.stdout.write(`\nRestore wallet: ${wallet.address}\n`);
  return wallet;
}
