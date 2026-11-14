/* Explicit measurement-point labels; never invent values or convert quantities. */
export const TEMPERATURE_ROLES=Object.freeze({temperature:'Opća temperatura',ambientTemp:'Okolina',inletTemp:'Ulaz sistema',outletTemp:'Izlaz sistema'});
export function labelTemperaturePoint(frame,role='temperature'){
 if(!Object.hasOwn(TEMPERATURE_ROLES,role))throw Error('Nepodržana mjerna tačka temperature.');
 if(frame?.format!=='clea.measurement/1'||!Array.isArray(frame.channels))throw Error('Neispravno senzorsko očitanje.');
 const result=structuredClone(frame);
 if(role!=='temperature'&&result.channels.some(c=>c.id===role))throw Error('Kanal mjerne tačke je već prisutan.');
 result.channels=result.channels.map(c=>{if(c.id!=='temperature')return c;if(c.unit!=='°C')throw Error('Mjerno mjesto zahtijeva temperaturu u °C.');return {...c,id:role};});
 result.context={...result.context,measurementPoint:TEMPERATURE_ROLES[role]};
 return result;
}
