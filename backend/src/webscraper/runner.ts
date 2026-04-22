import { computeDelta } from "./deltaCompute";
import { admissionFetcher, Result } from "./fetcher";
import fs from "fs";

async function run() {
    const latest = await admissionFetcher();

    const prev: Result = JSON.parse(
        await fs.promises.readFile("snapshot.json", "utf-8").catch(() => "{}")
    );

    const meritDelta = computeDelta(
        prev?.meritList || [],
        latest.meritList
    );

    const noticeDelta = computeDelta(
        prev?.notices || [],
        latest.notices
    );

    console.log("MERIT DELTA:", meritDelta);
    console.log("NOTICE DELTA:", noticeDelta);

    await fs.promises.writeFile(
        "snapshot.json",
        JSON.stringify(latest, null, 2)
    );
}

run();