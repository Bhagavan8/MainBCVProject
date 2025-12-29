function formatINR(num){
  try{ return '₹ ' + Number(num || 0).toLocaleString('en-IN', {maximumFractionDigits:0}); }catch(_){ return '₹ ' + num; }
}

function computeEmi(P, annualRate, months){
  const r = (annualRate/100)/12;
  if (r === 0) return P / months;
  const pow = Math.pow(1+r, months);
  return P * r * pow / (pow - 1);
}

function buildSchedule(P, annualRate, months){
  const r = (annualRate/100)/12;
  const emi = computeEmi(P, annualRate, months);
  let balance = P;
  const rows = [];
  for(let m=1;m<=months;m++){
    const interest = balance * r;
    const principal = emi - interest;
    balance = Math.max(0, balance - principal);
    rows.push({m, emi, interest, principal, balance});
  }
  return rows;
}

function updateDonut(principalAmt, interestAmt){
  const total = principalAmt + interestAmt;
  const r = 52;
  const C = 2 * Math.PI * r;
  const principalLen = total === 0 ? 0 : C * (principalAmt/total);
  const interestLen = total === 0 ? 0 : C * (interestAmt/total);
  const principalEl = document.getElementById('donutPrincipal');
  const interestEl = document.getElementById('donutInterest');
  principalEl.setAttribute('stroke-dasharray', `${principalLen} ${C-principalLen}`);
  principalEl.setAttribute('stroke-dashoffset', '0');
  interestEl.setAttribute('stroke-dasharray', `${interestLen} ${C-interestLen}`);
  interestEl.setAttribute('stroke-dashoffset', String(-principalLen));
}

function clamp(val, min, max){ return Math.min(Math.max(val, min), max); }

document.addEventListener('DOMContentLoaded', () => {
  let currentCalc = 'emi';
  const priceEl = document.getElementById('price');
  const priceRange = document.getElementById('priceRange');
  const downRange = document.getElementById('downPaymentRange');
  const downEl = document.getElementById('downPayment');
  const loanText = document.getElementById('loanAmountText');
  const downRangeLabel = document.getElementById('downRangeLabel');

  const tenureRange = document.getElementById('tenureRange');
  const tenureMonthsEl = document.getElementById('tenureMonths');
  const tenureYearsLabel = document.getElementById('tenureYearsLabel');

  const interestRange = document.getElementById('interestRange');
  const interestEl = document.getElementById('interest');
  const interestLabel = document.getElementById('interestLabel');

  const emiValueEl = document.getElementById('emiValue');
  const emiSubEl = document.getElementById('emiSub');
  const principalText = document.getElementById('principalText');
  const interestText = document.getElementById('interestText');
  const totalText = document.getElementById('totalText');
  const labelA = document.getElementById('labelA');
  const labelB = document.getElementById('labelB');
  const labelTotal = document.getElementById('labelTotal');

  const toggleSchedule = document.getElementById('toggleSchedule');
  const graphView = document.getElementById('graphView');
  const scheduleView = document.getElementById('scheduleView');
  const scheduleBody = document.getElementById('scheduleBody');

  const btnEmi = document.getElementById('calcBtnEmi');
  const btnTax = document.getElementById('calcBtnTax');
  const btnSalary = document.getElementById('calcBtnSalary');
  const btnInvest = document.getElementById('calcBtnInvest');
  const btnElig = document.getElementById('calcBtnElig');
  const btnBasic = document.getElementById('calcBtnBasic');
  const calcEmi = document.getElementById('calc-emi');
  const calcTax = document.getElementById('calc-tax');
  const calcSalary = document.getElementById('calc-salary');
  const calcInvest = document.getElementById('calc-invest');
  const calcElig = document.getElementById('calc-eligibility');
  const calcBasic = document.getElementById('calc-basic');

  const loanTypes = document.querySelectorAll('input[name="loanType"]');
  const priceLabel = document.getElementById('priceLabel');
  const downPaymentContainer = document.getElementById('downPaymentContainer');
  const priceHelp = document.getElementById('priceHelp');

  loanTypes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if(e.target.value === 'car'){
        priceLabel.textContent = 'Car Price';
        priceHelp.textContent = 'Total price before down payment';
        downPaymentContainer.classList.remove('d-none');
        
        // Optional: Set defaults for Car Loan
        if(Number(priceEl.value) < 100000) {
            priceEl.value = 500000;
            syncRangeFromPrice();
        }
      } else {
        priceLabel.textContent = 'Personal Loan Amount';
        priceHelp.textContent = 'Total loan amount required';
        downPaymentContainer.classList.add('d-none');
      }
      update();
    });
  });

  function syncDownFromRange(){
    const price = Number(priceEl.value || 0);
    const pct = Number(downRange.value);
    const down = Math.round(price * pct / 100);
    downEl.value = down;
    downRangeLabel.textContent = `${pct}%`;
    update();
  }
  function syncPriceFromRange(){
    priceEl.value = priceRange.value;
    update();
  }
  function syncRangeFromPrice(){
    priceRange.value = clamp(Number(priceEl.value||0), Number(priceRange.min), Number(priceRange.max));
    update();
  }
  function syncRangeFromDown(){
    const price = Number(priceEl.value || 0);
    const down = Number(downEl.value || 0);
    const pct = price > 0 ? Math.round((down/price)*100) : 0;
    downRange.value = clamp(pct, 0, Number(downRange.max));
    downRangeLabel.textContent = `${downRange.value}%`;
    update();
  }
  function syncTenureFromRange(){
    tenureMonthsEl.value = tenureRange.value;
    tenureYearsLabel.textContent = `${Math.round(tenureRange.value/12)} years`;
    update();
  }
  function syncRangeFromTenure(){
    const m = Number(tenureMonthsEl.value || 0);
    tenureRange.value = clamp(m, Number(tenureRange.min), Number(tenureRange.max));
    tenureYearsLabel.textContent = `${Math.round(tenureRange.value/12)} years`;
    update();
  }
  function syncInterestFromRange(){
    interestEl.value = interestRange.value;
    interestLabel.textContent = `${Number(interestRange.value).toFixed(1)}%`;
    update();
  }
  function syncRangeFromInterest(){
    interestRange.value = clamp(Number(interestEl.value), Number(interestRange.min), Number(interestRange.max));
    interestLabel.textContent = `${Number(interestRange.value).toFixed(1)}%`;
    update();
  }

  function update(){
    const price = Number(priceEl.value || 0);
    
    // Check loan type
    const loanTypeRadio = document.querySelector('input[name="loanType"]:checked');
    const loanType = loanTypeRadio ? loanTypeRadio.value : 'car';
    
    let down = 0;
    if (loanType === 'car') {
       down = clamp(Number(downEl.value || 0), 0, price);
    }
    
    const months = clamp(Number(tenureMonthsEl.value || 0), 1, 360);
    const rate = Number(interestEl.value || 0);
    
    if (currentCalc === 'basic'){
      labelA.textContent = '-';
      labelB.textContent = '-';
      labelTotal.textContent = '-';
      emiValueEl.textContent = 'Standard Calculator';
      emiSubEl.textContent = '';
      principalText.textContent = '-';
      interestText.textContent = '-';
      totalText.textContent = '-';
      updateDonut(0, 0);
      scheduleBody.innerHTML = '';
      graphView.classList.remove('d-none');
      scheduleView.classList.add('d-none');
      toggleSchedule.checked = false;
      toggleSchedule.disabled = true;
      return;
    }

    if (currentCalc === 'emi'){
      labelA.textContent = 'Principal Loan Amount';
      labelB.textContent = 'Total Interest Payable';
      labelTotal.textContent = 'Total Amount Payable';
      const P = Math.max(0, price - down);
      loanText.textContent = formatINR(P);
      const emi = computeEmi(P, rate, months);
      const total = Math.round(emi * months);
      const interestTotal = Math.round(total - P);
      emiValueEl.textContent = formatINR(Math.round(emi));
      emiSubEl.textContent = `EMI for ${Math.round(months/12)} years`;
      principalText.textContent = formatINR(P);
      interestText.textContent = formatINR(interestTotal);
      totalText.textContent = formatINR(total);
      updateDonut(P, interestTotal);
      const rows = buildSchedule(P, rate, months);
      scheduleBody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.m}</td>
          <td>${formatINR(Math.round(r.emi))}</td>
          <td>${formatINR(Math.round(r.interest))}</td>
          <td>${formatINR(Math.round(r.principal))}</td>
          <td>${formatINR(Math.round(r.balance))}</td>
        </tr>
      `).join('');
      toggleSchedule.disabled = false;
    }
    if (currentCalc === 'tax'){
      labelA.textContent = 'Net Monthly';
      labelB.textContent = 'Monthly Tax';
      labelTotal.textContent = 'Gross Monthly';
      const income = Number(document.getElementById('taxIncome').value || 0);
      const taxRate = Number(document.getElementById('taxRate').value || 0);
      const monthlyIncome = income/12;
      const monthlyTax = monthlyIncome * taxRate/100;
      const netMonthly = monthlyIncome - monthlyTax;
      emiValueEl.textContent = formatINR(Math.round(netMonthly));
      emiSubEl.textContent = 'Net Monthly Income';
      principalText.textContent = formatINR(Math.round(netMonthly));
      interestText.textContent = formatINR(Math.round(monthlyTax));
      totalText.textContent = formatINR(Math.round(monthlyIncome));
      updateDonut(netMonthly, monthlyTax);
      scheduleBody.innerHTML = '';
      graphView.classList.remove('d-none');
      scheduleView.classList.add('d-none');
      toggleSchedule.checked = false;
      toggleSchedule.disabled = true;
    }
    if (currentCalc === 'salary'){
      labelA.textContent = 'In-hand Monthly';
      labelB.textContent = 'Total Deductions';
      labelTotal.textContent = 'Gross Monthly';
      const ctc = Number(document.getElementById('ctcAnnual').value || 0);
      const monthly = ctc/12;
      const pf = monthly * (Number(document.getElementById('pfPct').value||0)/100);
      const other = monthly * (Number(document.getElementById('otherDeductPct').value||0)/100);
      const inHand = monthly - pf - other;
      emiValueEl.textContent = formatINR(Math.round(inHand));
      emiSubEl.textContent = 'In-hand Monthly';
      principalText.textContent = formatINR(Math.round(inHand));
      interestText.textContent = formatINR(Math.round(pf+other));
      totalText.textContent = formatINR(Math.round(monthly));
      updateDonut(inHand, pf+other);
      scheduleBody.innerHTML = '';
      graphView.classList.remove('d-none');
      scheduleView.classList.add('d-none');
      toggleSchedule.checked = false;
      toggleSchedule.disabled = true;
    }
    if (currentCalc === 'invest'){
      labelA.textContent = 'Principal Invested';
      labelB.textContent = 'Returns Earned';
      labelTotal.textContent = 'Future Value';
      const sip = Number(document.getElementById('sipMonthly').value || 0);
      const n = Number(document.getElementById('investMonths').value || 0);
      const r = Number(document.getElementById('investRate').value || 0)/100/12;
      const pow = Math.pow(1+r, n);
      const fv = r === 0 ? sip*n : sip * ((pow-1)/r) * (1+r);
      const principal = sip*n;
      const gains = fv - principal;
      emiValueEl.textContent = formatINR(Math.round(fv));
      emiSubEl.textContent = `Future Value (${Math.round(n/12)} yrs)`;
      principalText.textContent = formatINR(Math.round(principal));
      interestText.textContent = formatINR(Math.round(gains));
      totalText.textContent = formatINR(Math.round(fv));
      updateDonut(principal, gains);
      scheduleBody.innerHTML = '';
      graphView.classList.remove('d-none');
      scheduleView.classList.add('d-none');
      toggleSchedule.checked = false;
      toggleSchedule.disabled = true;
    }

    if (currentCalc === 'elig'){
      labelA.textContent = 'Max Monthly EMI';
      labelB.textContent = 'Remaining Income';
      labelTotal.textContent = 'Net Monthly Income';
      
      const income = Math.max(0, Number(document.getElementById('eligIncome').value || 0));
      const existingEmi = Math.max(0, Number(document.getElementById('eligEmi').value || 0));
      const rate = Number(document.getElementById('eligRate').value || 0);
      const tenureYears = Number(document.getElementById('eligTenure').value || 0);
      
      const netIncome = Math.max(0, income - existingEmi);
      const maxEmi = netIncome * 0.5; // 50% FOIR
      
      const r = (rate/100)/12;
      const n = tenureYears * 12;
      
      let maxLoan = 0;
      if (r === 0) {
          maxLoan = maxEmi * n;
      } else {
          const pow = Math.pow(1+r, n);
          maxLoan = (maxEmi * (pow - 1)) / (r * pow);
      }
      
      emiValueEl.textContent = formatINR(Math.round(maxLoan));
      emiSubEl.textContent = 'Maximum Loan Amount';
      
      principalText.textContent = formatINR(Math.round(maxEmi));
      interestText.textContent = formatINR(Math.round(netIncome - maxEmi));
      totalText.textContent = formatINR(Math.round(netIncome));
      
      updateDonut(maxEmi, netIncome - maxEmi);
      
      scheduleBody.innerHTML = '';
      graphView.classList.remove('d-none');
      scheduleView.classList.add('d-none');
      toggleSchedule.checked = false;
      toggleSchedule.disabled = true;
    }
  }

  toggleSchedule.addEventListener('change', () => {
    const showSchedule = toggleSchedule.checked;
    scheduleView.classList.toggle('d-none', !showSchedule);
    graphView.classList.toggle('d-none', showSchedule);
  });

  priceEl.addEventListener('input', () => { syncRangeFromPrice(); syncRangeFromDown(); });
  priceRange.addEventListener('input', () => { syncPriceFromRange(); syncDownFromRange(); });
  downRange.addEventListener('input', syncDownFromRange);
  downEl.addEventListener('input', syncRangeFromDown);
  tenureRange.addEventListener('input', syncTenureFromRange);
  tenureMonthsEl.addEventListener('input', syncRangeFromTenure);
  interestRange.addEventListener('input', syncInterestFromRange);
  interestEl.addEventListener('input', syncRangeFromInterest);

  // Tax events
  document.getElementById('taxIncome').addEventListener('input', update);
  document.getElementById('taxRateRange').addEventListener('input', () => {
    document.getElementById('taxRate').value = document.getElementById('taxRateRange').value;
    update();
  });
  document.getElementById('taxRate').addEventListener('input', () => {
    document.getElementById('taxRateRange').value = document.getElementById('taxRate').value;
    update();
  });

  // Salary events
  document.getElementById('ctcAnnual').addEventListener('input', update);
  document.getElementById('pfPct').addEventListener('input', update);
  document.getElementById('otherDeductPct').addEventListener('input', update);

  // Investment events
  document.getElementById('sipMonthly').addEventListener('input', update);
  document.getElementById('investMonthsRange').addEventListener('input', () => {
    document.getElementById('investMonths').value = document.getElementById('investMonthsRange').value;
    update();
  });
  document.getElementById('investMonths').addEventListener('input', () => {
    document.getElementById('investMonthsRange').value = document.getElementById('investMonths').value;
    update();
  });
  document.getElementById('investRateRange').addEventListener('input', () => {
    document.getElementById('investRate').value = document.getElementById('investRateRange').value;
    update();
  });
  document.getElementById('investRate').addEventListener('input', () => {
    document.getElementById('investRateRange').value = document.getElementById('investRate').value;
    update();
  });

  // Eligibility Events
  ['eligIncome', 'eligEmi', 'eligRate', 'eligTenure'].forEach(id => {
      document.getElementById(id).addEventListener('input', update);
  });

  // Basic Calculator Logic
  let calcExpression = '';
  const calcDisplay = document.getElementById('basicCalcDisplay');
  
  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      if(val === 'C') {
        calcExpression = '';
      } else if(val === 'DEL') {
        calcExpression = calcExpression.toString().slice(0, -1);
      } else if(val === '=') {
        try {
           let evalExpr = calcExpression
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/PI/g, 'Math.PI')
            .replace(/E/g, 'Math.E')
            .replace(/\^/g, '**')
            .replace(/%/g, '/100');
           calcExpression = String(eval(evalExpr)); 
        } catch(e) {
           calcExpression = 'Error';
        }
      } else {
        if(calcExpression === 'Error') calcExpression = '';
        calcExpression += val;
      }
      calcDisplay.value = calcExpression || '0';
    });
  });

  function setCalc(type){
    currentCalc = type;
    [btnEmi, btnTax, btnSalary, btnInvest, btnElig, btnBasic].forEach(btn => btn.classList.remove('active'));
    if (type==='emi') btnEmi.classList.add('active');
    if (type==='tax') btnTax.classList.add('active');
    if (type==='salary') btnSalary.classList.add('active');
    if (type==='invest') btnInvest.classList.add('active');
    if (type==='elig') btnElig.classList.add('active');
    if (type==='basic') btnBasic.classList.add('active');
    calcEmi.classList.toggle('d-none', type!=='emi');
    calcTax.classList.toggle('d-none', type!=='tax');
    calcSalary.classList.toggle('d-none', type!=='salary');
    calcInvest.classList.toggle('d-none', type!=='invest');
    calcElig.classList.toggle('d-none', type!=='elig');
    calcBasic.classList.toggle('d-none', type!=='basic');
    update();
  }
  btnEmi.addEventListener('click', ()=>setCalc('emi'));
  btnTax.addEventListener('click', ()=>setCalc('tax'));
  btnSalary.addEventListener('click', ()=>setCalc('salary'));
  btnInvest.addEventListener('click', ()=>setCalc('invest'));
  btnElig.addEventListener('click', ()=>setCalc('elig'));
  btnBasic.addEventListener('click', ()=>setCalc('basic'));

  syncDownFromRange();
  syncTenureFromRange();
  syncInterestFromRange();
  syncRangeFromPrice();
  setCalc('emi');
});
