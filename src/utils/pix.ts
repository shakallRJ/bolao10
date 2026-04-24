export function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(key: string, name: string, city: string, amount: number, txid: string = '***'): string {
  const formatField = (id: string, value: string) => {
    return id + value.length.toString().padStart(2, '0') + value;
  };

  // Normalize name and city (remove accents, keep alphanumeric and spaces, uppercase)
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/gi, "").toUpperCase();
  const normalizedName = normalize(name).substring(0, 25);
  const normalizedCity = normalize(city).substring(0, 15);
  const cleanTxid = txid.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 25) || '***';

  const gui = '0014br.gov.bcb.pix';
  const keyField = formatField('01', key);
  const merchantAccountInfo = formatField('26', gui + keyField);

  const payload = [
    formatField('00', '01'), // Payload Format Indicator
    merchantAccountInfo,
    formatField('52', '0000'), // Merchant Category Code
    formatField('53', '986'), // Transaction Currency (BRL)
    formatField('54', amount.toFixed(2)), // Transaction Amount
    formatField('58', 'BR'), // Country Code
    formatField('59', normalizedName), // Merchant Name
    formatField('60', normalizedCity), // Merchant City
    formatField('62', formatField('05', cleanTxid)), // Additional Data Field Template
  ].join('');

  const resultWithoutCrc = payload + '6304';
  return resultWithoutCrc + crc16(resultWithoutCrc);
}
