// Mappaa laitteen sijainti salivastaava-rooliin. Käytetään laitevika-
// tehtävien assigned_to-kentässä jotta salivastaava näkee oman salinsa
// vikailmoitukset etusivun Tehtävät-widgetissä.
export function salivastaavaRole(sijainti) {
  const s = (sijainti || '').toLowerCase()
  if (s.includes('kempele')) return 'salivastaava_kempele'
  if (s.includes('etu-lyötty') || s.includes('etu_lyotty') || s.includes('lyötty')) return 'salivastaava_etu_lyotty'
  return null
}
