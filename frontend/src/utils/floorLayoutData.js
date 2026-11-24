// frontend/src/utils/floorLayoutData.js
import { FLOOR_2F } from './floors/floor2F.js';
import { FLOOR_3F } from './floors/floor3F.js';
import { FLOOR_4F } from './floors/floor4F.js';
import { FLOOR_6F } from './floors/floor6F.js';
import { FLOOR_7F } from './floors/floor7F.js';
import { FLOOR_8F } from './floors/floor8F.js';

export const FLOOR_MODULES = {
  '2F': FLOOR_2F,
  '3F': FLOOR_3F,
  '4F': FLOOR_4F,
  '6F': FLOOR_6F,
  '7F': FLOOR_7F,
  '8F': FLOOR_8F
};

export const FLOOR_LAYOUT_DATA = FLOOR_MODULES;