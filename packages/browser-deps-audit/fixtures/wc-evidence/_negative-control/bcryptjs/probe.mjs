import bcrypt from "bcryptjs";
const h = bcrypt.hashSync("x", 4);
if (typeof h === "string" && h.length > 0) console.log("ok: bcryptjs");
else process.exit(1);
