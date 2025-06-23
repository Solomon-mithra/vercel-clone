import { createClient } from "redis";
import { downloadS3Folder } from "./aws";
// import { copyFinalDist, downloadS3Folder } from "./aws";
// import { buildProject } from "./utils";

const subscriber = createClient();
subscriber.on("error", (err: any) => console.log("Redis Client Error", err));
subscriber.connect();

async function main() {
    while(1) {
        const res = await subscriber.brPop(
            'build-queue',
            0
          );
        if (res) {
            console.log(res);
        }
        await downloadS3Folder(`t/${res?.element}`);
    }
}
main();