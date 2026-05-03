/* ── SkyVayu — Airports & Autocomplete ── */

var AIRPORTS = [
  {city:"Agartala",name:"Maharaja Bir Bikram Airport",icao:"VEAT",country:"India"},
  {city:"Agra",name:"Agra Airport",icao:"VIAG",country:"India"},
  {city:"Ahmedabad",name:"Sardar Vallabhbhai Patel Intl",icao:"VAAH",country:"India"},
  {city:"Aizawl",name:"Lengpui Airport",icao:"VELP",country:"India"},
  {city:"Allahabad",name:"Bamrauli Airport",icao:"VIAL",country:"India"},
  {city:"Amritsar",name:"Sri Guru Ram Dass Jee Intl",icao:"VIAR",country:"India"},
  {city:"Aurangabad",name:"Aurangabad Airport",icao:"VAAU",country:"India"},
  {city:"Bagdogra",name:"Bagdogra Airport",icao:"VEBD",country:"India"},
  {city:"Bengaluru",name:"Kempegowda Intl Airport",icao:"VOBL",country:"India"},
  {city:"Bhopal",name:"Raja Bhoj Airport",icao:"VABP",country:"India"},
  {city:"Bhubaneswar",name:"Biju Patnaik Intl Airport",icao:"VEBS",country:"India"},
  {city:"Chandigarh",name:"Chandigarh Intl Airport",icao:"VICG",country:"India"},
  {city:"Chennai",name:"Chennai Intl Airport",icao:"VOMM",country:"India"},
  {city:"Coimbatore",name:"Coimbatore Intl Airport",icao:"VOCB",country:"India"},
  {city:"Dehradun",name:"Jolly Grant Airport",icao:"VIDN",country:"India"},
  {city:"Delhi",name:"Indira Gandhi Intl Airport",icao:"VIDP",country:"India"},
  {city:"Dharamsala",name:"Gaggal Airport",icao:"VIGG",country:"India"},
  {city:"Dibrugarh",name:"Dibrugarh Airport",icao:"VEMN",country:"India"},
  {city:"Diu",name:"Diu Airport",icao:"VADU",country:"India"},
  {city:"Gaya",name:"Gaya Airport",icao:"VEGY",country:"India"},
  {city:"Goa",name:"Manohar Intl Airport",icao:"VAGO",country:"India"},
  {city:"Gorakhpur",name:"Gorakhpur Airport",icao:"VEGK",country:"India"},
  {city:"Guwahati",name:"Lokpriya Gopinath Bordoloi Intl",icao:"VEGT",country:"India"},
  {city:"Gwalior",name:"Gwalior Airport",icao:"VIGR",country:"India"},
  {city:"Hubli",name:"Hubli Airport",icao:"VOHB",country:"India"},
  {city:"Hyderabad",name:"Rajiv Gandhi Intl Airport",icao:"VOHS",country:"India"},
  {city:"Imphal",name:"Bir Tikendrajit Intl Airport",icao:"VEIM",country:"India"},
  {city:"Indore",name:"Devi Ahilya Bai Holkar Airport",icao:"VAID",country:"India"},
  {city:"Itanagar",name:"Donyi Polo Airport",icao:"VEDP",country:"India"},
  {city:"Jaipur",name:"Jaipur Intl Airport",icao:"VIJP",country:"India"},
  {city:"Jammu",name:"Jammu Airport",icao:"VIJU",country:"India"},
  {city:"Jamnagar",name:"Jamnagar Airport",icao:"VAJM",country:"India"},
  {city:"Jodhpur",name:"Jodhpur Airport",icao:"VIJO",country:"India"},
  {city:"Jorhat",name:"Jorhat Airport",icao:"VEJT",country:"India"},
  {city:"Kannur",name:"Kannur Intl Airport",icao:"VOKN",country:"India"},
  {city:"Khajuraho",name:"Khajuraho Airport",icao:"VEKH",country:"India"},
  {city:"Kochi",name:"Cochin Intl Airport",icao:"VOCI",country:"India"},
  {city:"Kolkata",name:"Netaji Subhas Chandra Bose Intl",icao:"VECC",country:"India"},
  {city:"Kozhikode",name:"Calicut Intl Airport",icao:"VOCL",country:"India"},
  {city:"Kullu",name:"Bhuntar Airport",icao:"VIBR",country:"India"},
  {city:"Leh",name:"Kushok Bakula Rimpochee Airport",icao:"VILH",country:"India"},
  {city:"Lucknow",name:"Chaudhary Charan Singh Intl",icao:"VILK",country:"India"},
  {city:"Ludhiana",name:"Sahnewal Airport",icao:"VILD",country:"India"},
  {city:"Madurai",name:"Madurai Airport",icao:"VOMD",country:"India"},
  {city:"Mangaluru",name:"Mangaluru Intl Airport",icao:"VOML",country:"India"},
  {city:"Mumbai",name:"Chhatrapati Shivaji Maharaj Intl",icao:"VABB",country:"India"},
  {city:"Mysuru",name:"Mysore Airport",icao:"VOMY",country:"India"},
  {city:"Nagpur",name:"Dr. Babasaheb Ambedkar Intl",icao:"VANP",country:"India"},
  {city:"Nashik",name:"Ozar Airport",icao:"VAOZ",country:"India"},
  {city:"Pantnagar",name:"Pantnagar Airport",icao:"VIPT",country:"India"},
  {city:"Patna",name:"Jay Prakash Narayan Intl Airport",icao:"VEPT",country:"India"},
  {city:"Port Blair",name:"Veer Savarkar Intl Airport",icao:"VOPB",country:"India"},
  {city:"Pune",name:"Pune Airport",icao:"VAPO",country:"India"},
  {city:"Raipur",name:"Swami Vivekananda Airport",icao:"VARP",country:"India"},
  {city:"Rajkot",name:"Rajkot Airport",icao:"VARK",country:"India"},
  {city:"Ranchi",name:"Birsa Munda Airport",icao:"VERC",country:"India"},
  {city:"Shillong",name:"Umroi Airport",icao:"VEUK",country:"India"},
  {city:"Shimla",name:"Shimla Airport",icao:"VISM",country:"India"},
  {city:"Silchar",name:"Silchar Airport",icao:"VEKU",country:"India"},
  {city:"Srinagar",name:"Sheikh ul Alam Intl Airport",icao:"VISR",country:"India"},
  {city:"Surat",name:"Surat Airport",icao:"VASU",country:"India"},
  {city:"Thiruvananthapuram",name:"Trivandrum Intl Airport",icao:"VOTV",country:"India"},
  {city:"Tiruchirappalli",name:"Tiruchirappalli Intl Airport",icao:"VOTR",country:"India"},
  {city:"Tirupati",name:"Tirupati Airport",icao:"VOTP",country:"India"},
  {city:"Udaipur",name:"Maharana Pratap Airport",icao:"VAUD",country:"India"},
  {city:"Vadodara",name:"Vadodara Airport",icao:"VABO",country:"India"},
  {city:"Varanasi",name:"Lal Bahadur Shastri Intl",icao:"VIBN",country:"India"},
  {city:"Vijayawada",name:"Vijayawada Airport",icao:"VOVZ",country:"India"},
  {city:"Visakhapatnam",name:"Visakhapatnam Airport",icao:"VOVR",country:"India"},
  {city:"Abu Dhabi",name:"Zayed Intl Airport",icao:"OMAA",country:"UAE"},
  {city:"Amsterdam",name:"Amsterdam Airport Schiphol",icao:"EHAM",country:"Netherlands"},
  {city:"Bangkok",name:"Suvarnabhumi Airport",icao:"VTBS",country:"Thailand"},
  {city:"Bangkok Don Mueang",name:"Don Mueang Intl Airport",icao:"VTBD",country:"Thailand"},
  {city:"Barcelona",name:"Barcelona El Prat Airport",icao:"LEBL",country:"Spain"},
  {city:"Beijing",name:"Beijing Capital Intl Airport",icao:"ZBAA",country:"China"},
  {city:"Chicago",name:"O'Hare Intl Airport",icao:"KORD",country:"USA"},
  {city:"Colombo",name:"Bandaranaike Intl Airport",icao:"VCBI",country:"Sri Lanka"},
  {city:"Dallas",name:"Dallas/Fort Worth Intl Airport",icao:"KDFW",country:"USA"},
  {city:"Dhaka",name:"Hazrat Shahjalal Intl Airport",icao:"VGHS",country:"Bangladesh"},
  {city:"Doha",name:"Hamad Intl Airport",icao:"OTHH",country:"Qatar"},
  {city:"Dubai",name:"Dubai Intl Airport",icao:"OMDB",country:"UAE"},
  {city:"Dubai Al Maktoum",name:"Al Maktoum Intl Airport",icao:"OMDW",country:"UAE"},
  {city:"Frankfurt",name:"Frankfurt Airport",icao:"EDDF",country:"Germany"},
  {city:"Hong Kong",name:"Hong Kong Intl Airport",icao:"VHHH",country:"Hong Kong"},
  {city:"Istanbul",name:"Istanbul Airport",icao:"LTFM",country:"Turkey"},
  {city:"Jakarta",name:"Soekarno-Hatta Intl Airport",icao:"WIII",country:"Indonesia"},
  {city:"Johannesburg",name:"O.R. Tambo Intl Airport",icao:"FAOR",country:"South Africa"},
  {city:"Islamabad",name:"New Islamabad Intl Airport",icao:"OPIS",country:"Pakistan"},
  {city:"Karachi",name:"Jinnah Intl Airport",icao:"OPKC",country:"Pakistan"},
  {city:"Kathmandu",name:"Tribhuvan Intl Airport",icao:"VNKT",country:"Nepal"},
  {city:"Kuala Lumpur",name:"KL Intl Airport",icao:"WMKK",country:"Malaysia"},
  {city:"Kuwait City",name:"Kuwait Intl Airport",icao:"OKBK",country:"Kuwait"},
  {city:"Lagos",name:"Murtala Muhammed Intl Airport",icao:"DNMM",country:"Nigeria"},
  {city:"Lahore",name:"Allama Iqbal Intl Airport",icao:"OPLA",country:"Pakistan"},
  {city:"London Gatwick",name:"Gatwick Airport",icao:"EGKK",country:"UK"},
  {city:"London Heathrow",name:"Heathrow Airport",icao:"EGLL",country:"UK"},
  {city:"Los Angeles",name:"Los Angeles Intl Airport",icao:"KLAX",country:"USA"},
  {city:"Madrid",name:"Adolfo Suarez Madrid-Barajas",icao:"LEMD",country:"Spain"},
  {city:"Male",name:"Velana Intl Airport",icao:"VRMM",country:"Maldives"},
  {city:"Manila",name:"Ninoy Aquino Intl Airport",icao:"RPLL",country:"Philippines"},
  {city:"Miami",name:"Miami Intl Airport",icao:"KMIA",country:"USA"},
  {city:"Milan",name:"Milan Malpensa Airport",icao:"LIMC",country:"Italy"},
  {city:"Moscow",name:"Sheremetyevo Intl Airport",icao:"UUEE",country:"Russia"},
  {city:"Muscat",name:"Muscat Intl Airport",icao:"OOMS",country:"Oman"},
  {city:"Nairobi",name:"Jomo Kenyatta Intl Airport",icao:"HKJK",country:"Kenya"},
  {city:"New York JFK",name:"John F Kennedy Intl Airport",icao:"KJFK",country:"USA"},
  {city:"New York Newark",name:"Newark Liberty Intl Airport",icao:"KEWR",country:"USA"},
  {city:"Paris CDG",name:"Charles de Gaulle Airport",icao:"LFPG",country:"France"},
  {city:"Riyadh",name:"King Khalid Intl Airport",icao:"OERK",country:"Saudi Arabia"},
  {city:"Rome",name:"Leonardo da Vinci Fiumicino",icao:"LIRF",country:"Italy"},
  {city:"San Francisco",name:"San Francisco Intl Airport",icao:"KSFO",country:"USA"},
  {city:"Seoul Incheon",name:"Incheon Intl Airport",icao:"RKSI",country:"South Korea"},
  {city:"Shanghai",name:"Pudong Intl Airport",icao:"ZSPD",country:"China"},
  {city:"Singapore",name:"Changi Airport",icao:"WSSS",country:"Singapore"},
  {city:"Sydney",name:"Sydney Kingsford Smith Airport",icao:"YSSY",country:"Australia"},
  {city:"Taipei",name:"Taiwan Taoyuan Intl Airport",icao:"RCTP",country:"Taiwan"},
  {city:"Tokyo Haneda",name:"Tokyo Intl Airport",icao:"RJTT",country:"Japan"},
  {city:"Tokyo Narita",name:"Narita Intl Airport",icao:"RJAA",country:"Japan"},
  {city:"Toronto",name:"Toronto Pearson Intl Airport",icao:"CYYZ",country:"Canada"},
  {city:"Vancouver",name:"Vancouver Intl Airport",icao:"CYVR",country:"Canada"},
  {city:"Zurich",name:"Zurich Airport",icao:"LSZH",country:"Switzerland"}
];
AIRPORTS.sort(function(a, b) { return a.city.localeCompare(b.city); });

var acActive = {};

function acInput(input, dropId) {
  var q    = input.value.trim().toLowerCase();
  var drop = document.getElementById(dropId);
  if (!drop) return;
  acActive[dropId] = -1;
  if (q.length < 1) { drop.classList.remove('open'); return; }
  var results = AIRPORTS.filter(function(a) {
    return a.city.toLowerCase().indexOf(q)    !== -1 ||
           a.icao.toLowerCase().indexOf(q)    !== -1 ||
           a.name.toLowerCase().indexOf(q)    !== -1 ||
           a.country.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 10);
  if (!results.length) { drop.classList.remove('open'); return; }
  drop.innerHTML = results.map(function(a, i) {
    var safeCity    = a.city.replace(/'/g, '&#39;');
    var safeIcao    = a.icao.replace(/'/g, '&#39;');
    var safeName    = a.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var safeCountry = a.country.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="ac-item" data-idx="' + i + '" data-city="' + safeCity + '" data-icao="' + safeIcao + '" onmousedown="acSelect(\'' + dropId + '\',\'' + safeCity + '\',\'' + safeIcao + '\')">'
      + '<div class="ac-city">' + a.city + '<span>' + safeName + ' &middot; ' + safeCountry + '</span></div>'
      + '<div class="ac-icao">' + a.icao + '</div>'
      + '</div>';
  }).join('');
  drop.classList.add('open');
}

function acSelect(dropId, city, icao) {
  var drop = document.getElementById(dropId);
  if (!drop) return;
  var inputId;
  if (dropId === 'ac-dep') {
    inputId = 'departure';
  } else if (dropId === 'ac-dest') {
    inputId = 'destination';
  } else if (dropId.indexOf('ac-sdep-') === 0) {
    inputId = 'sec-dep-' + dropId.replace('ac-sdep-', '');
  } else if (dropId.indexOf('ac-sdest-') === 0) {
    inputId = 'sec-dest-' + dropId.replace('ac-sdest-', '');
  }
  var el = inputId ? document.getElementById(inputId) : null;
  if (el) el.value = city + ' (' + icao + ')';
  drop.classList.remove('open');
}

function acBlur(dropId) {
  setTimeout(function() {
    var drop = document.getElementById(dropId);
    if (drop) drop.classList.remove('open');
  }, 150);
}

function acKey(e, dropId) {
  var drop  = document.getElementById(dropId);
  if (!drop) return;
  var items = drop.querySelectorAll('.ac-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acActive[dropId] = Math.min((acActive[dropId] || 0) + 1, items.length - 1);
    items.forEach(function(el, i) { el.classList.toggle('active', i === acActive[dropId]); });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acActive[dropId] = Math.max((acActive[dropId] || 0) - 1, 0);
    items.forEach(function(el, i) { el.classList.toggle('active', i === acActive[dropId]); });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    var idx = acActive[dropId];
    if (idx >= 0 && items[idx]) acSelect(dropId, items[idx].dataset.city, items[idx].dataset.icao);
  } else if (e.key === 'Escape') {
    drop.classList.remove('open');
  }
}
