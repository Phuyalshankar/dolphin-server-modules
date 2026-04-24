import { Sequelize } from 'sequelize';
// Note: This is a skeleton for Dolphin Sequelize Adapter
export async function connectDB() {
    const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST,
        dialect: 'mysql' // or 'postgres', 'sqlite'
    });
    
    try {
        await sequelize.authenticate();
        console.log('✅ SQL Database Connected');
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
    }
    
    return sequelize;
}
