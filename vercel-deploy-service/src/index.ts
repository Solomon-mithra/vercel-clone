import { createClient } from "redis";
import { downloadS3Folder, copyFinalDist } from "./aws";
import { buildProject } from "./utils";

const subscriber = createClient();
subscriber.on("error", (err: any) => console.log("Redis Client Error", err));
subscriber.connect();

console.log('Deploy-service: starting main loop...');
async function main() {
    console.log('Deploy-service: main invoked');
    while(1) {
        const res = await subscriber.brPop(
            'build-queue',
            0
          );
        if (res) {
            console.log(res);
        }
        // download the cloned repo source from the 'output/${id}' prefix
        await downloadS3Folder(`t/${res?.element}`);
        console.log("Downloaded folder from S3");
        const id = res?.element;
        if (id !== undefined) {
            await buildProject(id);
            console.log(`Built project for ${id}`);
            await copyFinalDist(id);
            console.log(`Copied final dist for ${id}`);
            // mark deployment as completed
            await subscriber.hSet("status", id, "deployed");
            console.log(`Marked ${id} as deployed`);
          } else {
            console.log("No id found in response.");
          }
    }
}
main();