function mod10(block) {
  let sum = 0;
  let multiplier = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    let prod = parseInt(block[i], 10) * multiplier;
    sum += Math.floor(prod / 10) + (prod % 10);
    multiplier = multiplier === 2 ? 1 : 2;
  }
  let rem = sum % 10;
  return rem === 0 ? 0 : 10 - rem;
}

function mod11Arrecadacao(block) {
  let sum = 0;
  let multiplier = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    sum += parseInt(block[i], 10) * multiplier;
    multiplier++;
    if (multiplier > 9) multiplier = 2;
  }
  let rem = sum % 11;
  if (rem === 0 || rem === 1) return 0;
  return 11 - rem;
}

function barcodeToLinhaDigitavel(barcode) {
  if (barcode.length !== 44) return barcode;

  if (barcode[0] === '8') {
    // Arrecadação
    const isMod10 = barcode[2] === '6' || barcode[2] === '7';
    let linha = '';
    for (let i = 0; i < 4; i++) {
      const block = barcode.substr(i * 11, 11);
      const digit = isMod10 ? mod10(block) : mod11Arrecadacao(block);
      linha += block + digit;
    }
    return linha;
  } else {
    // Cobrança
    const bank = barcode.substr(0, 3);
    const currency = barcode.substr(3, 1);
    const dv = barcode.substr(4, 1);
    const factor = barcode.substr(5, 4);
    const amount = barcode.substr(9, 10);
    const freeField = barcode.substr(19, 25);

    const block1 = bank + currency + freeField.substr(0, 5);
    const dv1 = mod10(block1);
    const field1 = block1 + dv1;

    const block2 = freeField.substr(5, 10);
    const dv2 = mod10(block2);
    const field2 = block2 + dv2;

    const block3 = freeField.substr(15, 10);
    const dv3 = mod10(block3);
    const field3 = block3 + dv3;

    const field4 = dv;
    const field5 = factor + amount;

    return field1 + field2 + field3 + field4 + field5;
  }
}

console.log("Arrecadacao: " + barcodeToLinhaDigitavel("85850000005950403282626407202625123857598729"));
console.log("Expected:    858500000053950403282628640720262515238575987294");
