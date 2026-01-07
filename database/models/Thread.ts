import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize';

interface ThreadAttributes {
  threadID: string;
  name: string;
  prefix: string;
  rankup: boolean;
  bannedUsers?: string; // JSON string array of user IDs
  settings?: string; // JSON string để lưu các cài đặt
  info?: Record<string, unknown>;
}

class Thread extends Model<ThreadAttributes> implements ThreadAttributes {
  public threadID!: string;
  public name!: string;
  public prefix!: string;
  public rankup!: boolean;
  public bannedUsers?: string;
  public settings?: string;
  public info?: Record<string, unknown>;
}

Thread.init({
  threadID: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    defaultValue: "Nhóm chưa đặt tên"
  },
  info: {
    type: DataTypes.JSON,
    allowNull: true
  },
  prefix: {
    type: DataTypes.STRING,
    defaultValue: "!"
  },
  rankup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  bannedUsers: {
    type: DataTypes.TEXT,
    defaultValue: "[]"
  },
  settings: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'Thread'
});

export default Thread;
