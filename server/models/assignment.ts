import { DB } from "../db";
import { Model } from "./model";

export class Assignment extends Model{
  constructor(dbo: DB) {
		super(dbo, 'assignments');
  }
}