import db from './imports/dbConn.js';

async function checkTables() {
    try {
        const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables:");
        res.rows.forEach(r => console.log(r.table_name));
        
        const banksRes = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'banks'");
        if(banksRes.rows.length > 0) {
            console.log("Banks columns:");
            banksRes.rows.forEach(r => console.log(r.column_name, r.data_type));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTables();
