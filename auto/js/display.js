/* Stable Bosnian numeric presentation, including browsers without bs-BA ICU. */
export function formatNumber(value,places=4){
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 if(!Number.isSafeInteger(places)||places<0||places>8)throw Error('Nepodržan broj decimalnih mjesta.');
 if(value!==0&&Math.abs(value)<10**(-places))return value.toExponential(3).replace('.',',');
 const parts=(Object.is(value,-0)?0:value).toFixed(places).split('.');
 const fraction=(parts[1]||'').replace(/0+$/,'');
 const integer=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 return integer+(fraction?','+fraction:'');
}
export function formatMoney(value){
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 const parts=(Object.is(value,-0)?0:value).toFixed(2).split('.');
 return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+(parts[1]||'00');
}
