// Mappaa toimipisteen slug tai laitteen sijainti salivastaava-rooliin.
// Käytetään tehtävien assigned_to-kentässä.
export function salivastaavaRole(sijainti) {
  const s = (sijainti || '').toLowerCase()
  if (s.includes('kempele'))      return 'salivastaava_kempele'
  if (s.includes('linnakangas'))  return 'salivastaava_linnakangas'
  if (s.includes('toppilansaari')) return 'salivastaava_toppilansaari'
  if (s.includes('lyotty') || s.includes('lyötty') || s.includes('etu-ly')) return 'salivastaava_etu_lyotty'
  return null
}
