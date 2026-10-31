import { openStore, passwordHash } from "./store";
// Password is read through stdin; never supply it in command-line arguments.
const [number, name, role = "trainee"] = process.argv.slice(2);
if (
  !/^\d{4,14}$/.test(number || "") ||
  !name ||
  !["trainee", "trainer"].includes(role)
)
  throw new Error(
    'Usage: npm run account -- TRAINING_NUMBER "NAME" [trainee|trainer] (password via stdin)',
  );
let input = "";
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/[\r\n]+$/, "");
if (password.length < 10 || password.length > 128)
  throw new Error("Password must be 10–128 characters.");
const store = openStore(process.env.DATA_DIR || "./data");
const { salt, hash } = await passwordHash(password);
try {
  store.db.exec("BEGIN IMMEDIATE");
  store.db
    .prepare(
      "INSERT INTO users(training_number,name,salt,password_hash,role) VALUES(?,?,?,?,?) ON CONFLICT(training_number) DO UPDATE SET name=excluded.name,salt=excluded.salt,password_hash=excluded.password_hash,role=excluded.role",
    )
    .run(number, name, salt, hash, role);
  store.db
    .prepare(
      "DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE training_number=?)",
    )
    .run(number);
  store.db.exec("COMMIT");
  console.log("Account saved. Existing sessions revoked.");
} finally {
  store.db.close();
}
