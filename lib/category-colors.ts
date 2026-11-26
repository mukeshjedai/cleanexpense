import {categories} from './statement';
const palette=['#7155d6','#00876b','#b97600','#c83d60','#267db3','#9c459a','#43843a','#b85922','#586c9f','#137a92','#7a6d55','#6b6878'];
export const categoryColor=(category:string)=>palette[Math.max(0,categories.indexOf(category as typeof categories[number]))%palette.length];
