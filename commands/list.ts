
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import Table from "cli-table3";

const execAsync = promisify(exec);

interface ProcessInfo {
  command: string;
  pid: string;
  user: string;
  fd: string;
  type: string;
  device: string;
  sizeOff: string;
  node: string;
  name: string;
  port: number;
}

export async function listProcesses(startPort: number, endPort: number): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -iTCP:${startPort}-${endPort} -sTCP:LISTEN -n -P`
    );

    const lines = stdout.trim().split("\n");
    // Skip header
    lines.shift();

    const processes: ProcessInfo[] = lines.map((line) => {
      const parts = line.split(/\s+/);
      const name = parts[8];
      const port = parseInt(name?.split(":").pop() || "0", 10);
      
      return {
        command: parts[0],
        pid: parts[1],
        user: parts[2],
        fd: parts[3],
        type: parts[4],
        device: parts[5],
        sizeOff: parts[6],
        node: parts[7],
        name: name,
        port: port,
      };
    }).filter(p => !isNaN(p.port));

    return processes;
  } catch (error: any) {
    if (error.code === 1) {
        // lsof returns exit code 1 if no files/processes are found
        return [];
    }
    console.error(chalk.red("Error listing processes:"), error.message);
    return [];
  }
}

export async function printProcessTable(processes: ProcessInfo[]) {
    if (processes.length === 0) {
        console.log(chalk.yellow("No processes found on the specified ports."));
        return;
    }

    const table = new Table({
        head: [chalk.cyan("Command"), chalk.cyan("PID"), chalk.cyan("User"), chalk.cyan("Port")],
    });
    
    processes.forEach(p => {
        table.push([p.command, p.pid, p.user, chalk.green(p.port.toString())]);
    });
    
    console.log(table.toString());
}
