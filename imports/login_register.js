import bcrypt from 'bcrypt';

const saltRounds = 5;

export async function registerUser(username, password, role, db) {
    if (username) username = username.toLowerCase();

    try {
        const user = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (user.rows.length > 0) {
            return "Already exists";
        } else {
            // Password Hashing
            const hash = await bcrypt.hash(password, saltRounds);
            const result = await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", [
                username, hash, role
            ]);
            return result;
        }
    } catch (err) {
        console.error(err)
    }
}

export async function loginUser(username, password, db) {
    if (username) username = username.toLowerCase();
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        const data = result.rows;

        if (data.length > 0) {
            const savedPassword = data[0].password;
            const passwordMatch = await new Promise((resolve, reject) => {
                bcrypt.compare(password, savedPassword, (err, correct) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(correct);
                    }
                });
            });

            if (passwordMatch) {
                return data[0];
            } else {
                return "wrong password";
            }
        } else {
            return "does not exist";
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}

export async function changeUserPassword(userId, oldPassword, newPassword, db) {
    try {
        const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
        const data = result.rows;

        if (data.length > 0) {
            const savedPassword = data[0].password;
            const passwordMatch = await new Promise((resolve, reject) => {
                bcrypt.compare(oldPassword, savedPassword, (err, correct) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(correct);
                    }
                });
            });

            if (passwordMatch) {
                const hash = await bcrypt.hash(newPassword, saltRounds);
                await db.query("UPDATE users SET password = $1 WHERE id = $2", [hash, userId]);
                return { success: true };
            } else {
                return { success: false, message: "Wrong current password" };
            }
        } else {
            return { success: false, message: "User not found" };
        }
    } catch (err) {
        console.error("changeUserPassword error:", err);
        throw err;
    }
}