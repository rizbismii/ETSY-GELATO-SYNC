import { syncCustomerDesignPhotos } from "../src/lib/printify.ts";

const only = process.argv.slice(2);
const result = await syncCustomerDesignPhotos(only.length ? only : ["live_sneaker_star", "live_sneaker_star_w"]);
for (const note of result.notes) console.log(note);
