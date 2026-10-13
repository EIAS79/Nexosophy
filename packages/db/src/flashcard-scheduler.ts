export type FlashcardState={intervalDays:number;easeFactor:number;repetitions:number;lapses:number;leeched:boolean;dueAt:Date};
export type FlashcardGrade="again"|"hard"|"good"|"easy";
export function scheduleFlashcard(before:FlashcardState,grade:FlashcardGrade,now=new Date()):FlashcardState{
 let interval=Number(before.intervalDays)||0,ease=Number(before.easeFactor)||2.5,reps=before.repetitions,lapses=before.lapses;
 if(grade==="again"){interval=1;reps=0;lapses+=1;ease=Math.max(1.3,ease-0.2);}
 else if(grade==="hard"){interval=Math.max(1,Math.round(Math.max(interval,1)*1.2));reps+=1;ease=Math.max(1.3,ease-0.15);}
 else if(grade==="good"){reps+=1;interval=reps===1?1:reps===2?6:Math.max(1,Math.round(Math.max(interval,1)*ease));}
 else{reps+=1;ease=Math.min(3.5,ease+0.15);interval=reps===1?4:Math.max(2,Math.round(Math.max(interval,1)*ease*1.3));}
 return{intervalDays:interval,easeFactor:ease,repetitions:reps,lapses,leeched:lapses>=8,dueAt:new Date(now.getTime()+interval*86400000)};
}
