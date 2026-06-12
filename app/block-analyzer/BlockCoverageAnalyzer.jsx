import { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext } from "react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const DataContext = createContext();

// ─── DATA ─────────────────────────────────────────────────────────────────────
const COVERAGE_DATA = {"Capital":{"Zone 01":{"total":13,"covered":[307,308,310,317,318,319,320,321,346],"gaps":[309,322,323,344],"coverage_pct":69},"Zone 02":{"total":17,"covered":[301,302,303,304,305,306,311,315,351,356],"gaps":[312,313,314,316,353,354,357],"coverage_pct":59},"Zone 03":{"total":17,"covered":[408,410,412,414,422,426,428,434],"gaps":[402,404,406,424,430,432,436,438,592],"coverage_pct":47},"Zone 04":{"total":15,"covered":[324,326,327,333,335,336,337,340,341,342,373],"gaps":[325,338,339,343],"coverage_pct":73},"Zone 05":{"total":13,"covered":[328,329,330,331,332,358,359,360,361,362,364],"gaps":[334,363],"coverage_pct":85},"Zone 06":{"total":18,"covered":[368,407,411,419,701,705,707,711],"gaps":[365,366,367,369,405,413,421,423,425,713],"coverage_pct":44},"Zone 07":{"total":5,"covered":[709,721,729],"gaps":[733,816],"coverage_pct":60},"Zone 08":{"total":9,"covered":[604,605,606],"gaps":[380,381,382,601,602,603],"coverage_pct":33},"Zone 09":{"total":8,"covered":[608,611,624],"gaps":[607,609,623,633,634],"coverage_pct":38},"Zone 10":{"total":6,"covered":[626,644,743,745],"gaps":[625,815],"coverage_pct":67}},"Muharraq":{"Zone 01":{"total":4,"covered":[225,226,228,229],"gaps":[],"coverage_pct":100},"Zone 02":{"total":6,"covered":[203,205,206,222],"gaps":[209,221],"coverage_pct":67},"Zone 03":{"total":7,"covered":[202,204,210,223,224],"gaps":[208,227],"coverage_pct":71},"Zone 04":{"total":8,"covered":[207,211,212,215],"gaps":[213,214,216,217],"coverage_pct":50},"Zone 05":{"total":13,"covered":[252,253,254,255,257,258,263,264],"gaps":[251,256,265,266,269],"coverage_pct":62},"Zone 06":{"total":7,"covered":[231,236],"gaps":[232,233,234,235,237],"coverage_pct":29},"Zone 07":{"total":9,"covered":[240,242,243,244],"gaps":[241,245,246,247,248],"coverage_pct":44},"Zone 08":{"total":20,"covered":[105,108,109,110,111,112,113,128],"gaps":[101,102,103,104,106,107,115,116,117,118,119,121],"coverage_pct":40}},"North":{"Zone 01":{"total":19,"covered":[450,460,502,504,514,526,536],"gaps":[444,454,456,458,506,508,518,520,522,524,528,530],"coverage_pct":37},"Zone 02":{"total":16,"covered":[537,540,580],"gaps":[531,538,539,541,542,543,544,582,583,584,586,588,590],"coverage_pct":19},"Zone 03":{"total":23,"covered":[552,555,1002,1010],"gaps":[550,553,557,559,561,565,569,587,581,585,589,591,1001,1003,1004,1006,1009,1089,1095],"coverage_pct":17},"Zone 04":{"total":15,"covered":[439,447,457,704,708,714],"gaps":[431,433,435,441,455,702,706,712,744],"coverage_pct":40},"Zone 05":{"total":23,"covered":[463,469,481,513,515,517,525,527,529,533],"gaps":[449,453,465,471,473,475,477,479,505,507,509,521,523],"coverage_pct":43},"Zone 06":{"total":7,"covered":[732,734,738,740,742],"gaps":[730,736],"coverage_pct":71},"Zone 07":{"total":18,"covered":[545,571,575,579,752,754,1014,1022],"gaps":[547,549,551,577,756,758,760,762,1012,1019],"coverage_pct":44},"Zone 08":{"total":4,"covered":[1016,1203],"gaps":[1204,1206],"coverage_pct":50},"Zone 09":{"total":4,"covered":[1209,1210],"gaps":[1205,1207],"coverage_pct":50},"Zone 10":{"total":4,"covered":[1218],"gaps":[1208,1212,1214],"coverage_pct":25},"Zone 11":{"total":5,"covered":[1046,1215],"gaps":[1211,1213,1216],"coverage_pct":40},"Zone 12":{"total":15,"covered":[1017,1020,1025,1032,1033,1034,1038],"gaps":[1018,1026,1027,1028,1037,1041,1042,1044],"coverage_pct":47}},"South":{"Zone 01":{"total":11,"covered":[718,720,801,803,806,810],"gaps":[802,804,805,807,808],"coverage_pct":55},"Zone 02":{"total":6,"covered":[809,812,814],"gaps":[813,840,841],"coverage_pct":50},"Zone 03":{"total":6,"covered":[933,934,935,941],"gaps":[922,937],"coverage_pct":67},"Zone 04":{"total":6,"covered":[645,929,939],"gaps":[643,646,931],"coverage_pct":50},"Zone 05":{"total":6,"covered":[901,903,905,925,927],"gaps":[910],"coverage_pct":83},"Zone 06":{"total":9,"covered":[913,914,915,917,919,923],"gaps":[916,918,921],"coverage_pct":67},"Zone 07":{"total":13,"covered":[746,902,904,908,912,928,932],"gaps":[748,906,920,924,926,930],"coverage_pct":54},"Zone 08":{"total":30,"covered":[636,907,911,942,943,945,951,952,957,960],"gaps":[613,614,615,616,635,909,946,948,949,950,953,954,955,958,959,965,981,982,983,985],"coverage_pct":33},"Zone 09":{"total":21,"covered":[1048,1057],"gaps":[944,947,976,986,1051,1052,1054,1055,1056,1058,1061,1062,1063,1064,1067,1068,1069,1070,1099],"coverage_pct":10},"Zone 10":{"total":22,"covered":[],"gaps":[961,967,971,973,987,988,989,995,997,998,999,1101,1102,1103,1104,1106,1107,1108,1110,1111,1112,1113],"coverage_pct":0}}};

// ─── POPULATION DATA ──────────────────────────────────────────────────────────
const POP_DATA = {
  Capital:  { total:544290, bahraini:160297, non_bahraini:383993, males:368693, females:175597 },
  Muharraq: { total:289155, bahraini:141080, non_bahraini:148075, males:171095, females:118060 },
  North:    { total:419644, bahraini:298246, non_bahraini:121398, males:228919, females:190725 },
  South:    { total:323970, bahraini:127729, non_bahraini:196241, males:211168, females:112802 },
};
const TOTAL_POP = 1577059;

// BLOCK_AREA_NAMES and BLOCK_PHARMACY_MAP injected below at build time
const BLOCK_AREA_NAMES = {"746":"Aáli","748":"Aáli","965":"Al Door","961":"Algainah","929":"Al Hajyat","931":"Al Hajyat","935":"Al Hajyat","939":"Al Hajyat","901":"Al Hunaniya","903":"Al Hunaniya","971":"Al Jaseera","1099":"Al Mamtala","943":"Al Mazrooeeah","949":"Al Moaaskar","988":"Al Omar","983":"Al Qarah","987":"Al Qarah","967":"Al Qareen","906":"Al Rawdha","930":"Al Rawdha","947":"Al Riffah","995":"Al Romaitha","981":"Al Rumamin","982":"Al Rumamin","989":"Al Shabak","951":"Askar","945":"Awali","946":"Awali","1063":"Belaj Al Jazair","1064":"Belaj Al Jazair","913":"Bu Kuwarah","917":"Bu Kuwarah","919":"Bu Kuwarah","921":"Bu Kuwarah","923":"Bu Kuwarah","925":"Bu Kuwarah","927":"Bu Kuwarah","1048":"Dar Kulaib","999":"Durrat Al Bahrain","905":"East Riffa","907":"East Riffa","909":"East Riffa","911":"East Riffa","959":"Hafeera","645":"Hawrat Sanad","973":"Hidd Al Jamal","1067":"Hlaitan","1062":"Horat Anaqa","801":"Isa Town","802":"Isa Town","803":"Isa Town","804":"Isa Town","805":"Isa Town","806":"Isa Town","807":"Isa Town","808":"Isa Town","809":"Isa Town","810":"Isa Town","812":"Isa Town","813":"Isa Town","814":"Isa Town","840":"Isa Town","841":"Isa Town","920":"Jari Al Shaikh","924":"Jari Al Shaikh","926":"Jari Al Shaikh","957":"Jaw","960":"Jaw","1061":"Jazaer Beach","613":"Juzur Al Dar","948":"Lhassay","635":"Maameer","636":"Maameer","1069":"Mamlahat Al Mamtala","1070":"Mamlahat Al Mamtala","953":"Mazraa","1101":"New districts","1102":"New districts","1103":"New districts","1104":"New districts","1106":"New districts","1107":"New districts","1108":"New districts","1110":"New districts","1111":"New districts","1112":"New districts","1113":"New districts","918":"New districts","932":"New districts","944":"New districts","950":"New districts","955":"New districts","643":"Nuwaydirat","646":"Nuwaydirat","954":"Ras Abu Jarjor","958":"Ras Hayan","952":"Ras Zuwaid","914":"Riffa / Albuhair","915":"Riffa / Albuhair","916":"Riffa / Albuhair","922":"Riffa / Albuhair","933":"Riffa / Albuhair","934":"Riffa / Albuhair","937":"Riffa / Albuhair","941":"Riffa / Albuhair","976":"Sukhair","985":"Sukhair","942":"Swayfra","998":"Trafi","614":"Um Albaidh","615":"Um Albaidh","616":"Um Albaidh","986":"Um Jadir","997":"Umm Jidr Al Summan","1068":"Wadi Ali","928":"Wadi Al Sale","902":"West Riffa","904":"West Riffa","908":"West Riffa","910":"West Riffa","912":"West Riffa","1051":"Zallaq","1052":"Zallaq","1054":"Zallaq","1055":"Zallaq","1056":"Zallaq","718":"Zayed Town","720":"Zayed Town","732":"Aáli","734":"Aáli","736":"Aáli","738":"Aáli","740":"Aáli","742":"Aáli","744":"Aáli","469":"Abu Saiba'a","471":"Abu Saiba'a","473":"Abu Saiba'a","475":"Abu Saiba'a","463":"Al Hajar","465":"Al Hajar","1001":"Al Jasra","1002":"Al Jasra","1003":"Al Jasra","1004":"Al Jasra","1006":"Al Jasra","1016":"Al Lawzi","1018":"Al Lawzi","1020":"Al Lawzi","587":"Al Muhamadyia","477":"Al Shakhura","479":"Al Shakhura","481":"Al Shakhura","537":"Bani Jamra","539":"Bani Jamra","541":"Bani Jamra","543":"Bani Jamra","518":"Barbar","520":"Barbar","522":"Barbar","524":"Barbar","526":"Barbar","528":"Barbar","530":"Barbar","550":"Budaiya","552":"Budaiya","553":"Budaiya","555":"Budaiya","557":"Budaiya","559":"Budaiya","455":"Buqwa","457":"Buqwa","752":"Buri","754":"Buri","756":"Buri","758":"Buri","760":"Buri","762":"Buri","1017":"Damistan","1019":"Damistan","1022":"Damistan","1046":"Dar Kulaib","536":"Diraz","538":"Diraz","540":"Diraz","542":"Diraz","544":"Diraz","1038":"Hamad Town","1203":"Hamad Town","1204":"Hamad Town","1205":"Hamad Town","1206":"Hamad Town","1207":"Hamad Town","1208":"Hamad Town","1209":"Hamad Town","1210":"Hamad Town","1211":"Hamad Town","1212":"Hamad Town","1213":"Hamad Town","1214":"Hamad Town","1215":"Hamad Town","1216":"Hamad Town","1009":"Hamala","1010":"Hamala","1012":"Hamala","1014":"Hamala","444":"Hillat AbdulSaleh","714":"Hoarat Aáli","730":"Hoarat Aáli","431":"Jabalt Hibshi","433":"Jabalt Hibshi","435":"Jabalt Hibshi","561":"Janabiya","565":"Janabiya","569":"Janabiya","571":"Janabiya","575":"Janabiya","577":"Janabiya","579":"Janabiya","502":"Jannusan","504":"Jannusan","506":"Jannusan","508":"Jannusan","591":"Jedah","514":"Jind Al Haj","454":"Karana","456":"Karana","458":"Karana","460":"Karana","1025":"Karzakan","1026":"Karzakan","1027":"Karzakan","1028":"Karzakan","1095":"King Fahad Causway","505":"Magaba","507":"Magaba","509":"Magaba","513":"Magaba","1032":"Malkiya","1033":"Malkiya","1034":"Malkiya","450":"Maqsha","529":"Markh","531":"Markh","533":"Markh","1218":"New districts","515":"New districts","532":"North City","534":"North City","535":"North City","580":"Northern City","581":"Northern City","582":"Northern City","583":"Northern City","584":"Northern City","585":"Northern City","586":"Northern City","588":"Northern City","589":"Northern City","590":"Northern City","439":"Northern Sehla","441":"Northern Sehla","447":"Qadam","449":"Qadam","453":"Qadam","545":"Quraya","547":"Quraya","549":"Quraya","551":"Quraya","517":"Saar","521":"Saar","523":"Saar","525":"Saar","527":"Saar","1037":"Sadaq","1041":"Safriya","702":"Salmabad","704":"Salmabad","706":"Salmabad","708":"Salmabad","712":"Salmabad","1042":"Shahrakan","1044":"Shahrakan","1089":"Um Al Naasan","607":"Abu Al Aish","367":"Abu Buham","366":"Adhari","369":"Adhari","327":"Adliya","336":"Adliya","623":"Al Akr Al Sharqi","361":"Al Belad Al Qadeem","362":"Al Belad Al Qadeem","363":"Al Belad Al Qadeem","364":"Al Belad Al Qadeem","322":"Alcornish","324":"Al Fatih","342":"Al Guraifa","611":"Al Hamriya","365":"Al Khamiss","606":"Al Kharjiya","303":"Alnaim","314":"Alnaim","733":"Al Nasfa","438":"Alqalla","309":"Alsalmaniya","310":"Alsalmaniya","311":"Alsalmaniya","329":"Alsalmaniya","428":"Alseef District","436":"Alseef District","328":"Al Suqayyah","313":"Alsuwayfia","351":"Alsuwayfia","353":"Alsuwayfia","344":"Alwajeha Albhariya","346":"Alwajeha Albhariya","332":"Bu Asheera","373":"Bu Ghasal","330":"Bu Ghazal","331":"Bu Ghazal","354":"Burhama","357":"Burhama","315":"Commercial Area","316":"Commercial Area","412":"Daih","414":"Daih","317":"Diplomatic Area","307":"Gudaibiya","308":"Gudaibiya","321":"Gudaibiya","325":"Gudaibiya","326":"Gudaibiya","338":"Gudaibiya","318":"Hoora","319":"Hoora","320":"Hoora","815":"Isa Town","816":"Isa Town","721":"Jid Ali","419":"Jidhafs","421":"Jidhafs","422":"Jidhafs","423":"Jidhafs","424":"Jidhafs","425":"Jidhafs","426":"Jidhafs","340":"Juffair","341":"Juffair","729":"Jurdab","430":"Karbabad","432":"Karbabad","434":"Karbabad","633":"Maameer","634":"Maameer","602":"Mahaza","603":"Mahaza","334":"Mahooz","323":"Manama Center","343":"Minaa Salman Industrial Area","605":"Murgoban","411":"Musala","413":"Musala","380":"Nahib Saleh","381":"Nahib Saleh","382":"Nahib Saleh","592":"Nurana","644":"Nuwaydirat","604":"Qarya","312":"Qufool","306":"Ras Ruman","356":"Salhiya","402":"Sanabis","404":"Sanabis","405":"Sanabis","406":"Sanabis","408":"Sanabis","410":"Sanabis","743":"Sanad","745":"Sanad","601":"Sitra Industrial Area","301":"Souq","302":"Souq","304":"Souq","305":"Souq","368":"Southern Sehla","609":"Sufala","407":"Tashan","701":"Tubli","705":"Tubli","707":"Tubli","709":"Tubli","711":"Tubli","610":"Um Albaidh","333":"Um Alhassam","335":"Um Alhassam","337":"Um Alhassam","339":"Um Alhassam","608":"Wadyan","624":"Western Aker","625":"Western Aker","626":"Western Aker","358":"Zinj","359":"Zinj","360":"Zinj","228":"Al Sayh","229":"Al Sayh","257":"Amwaj","258":"Amwaj","263":"Amwaj","264":"Amwaj","265":"Amwaj","266":"Amwaj","269":"Amwaj","240":"Arad","241":"Arad","242":"Arad","243":"Arad","244":"Arad","245":"Arad","246":"Arad","221":"Busaiteen","222":"Busaiteen","223":"Busaiteen","225":"Busaiteen","226":"Busaiteen","227":"Busaiteen","231":"Dair","232":"Dair","233":"Dair","251":"Galali","252":"Galali","253":"Galali","254":"Galali","255":"Galali","256":"Galali","248":"Halat Alnaim","247":"Halat Alsulta","101":"Hidd","102":"Hidd","103":"Hidd","104":"Hidd","105":"Hidd","106":"Hidd","107":"Hidd","108":"Hidd","109":"Hidd","110":"Hidd","111":"Hidd","112":"Hidd","113":"Hidd","115":"Hidd","116":"Hidd","117":"Hidd","118":"Hidd","119":"Hidd","121":"Hidd","128":"Hidd"};
const BLOCK_PHARMACY_MAP = {"463":[{"name":"AlNainoon Alternative Medicine Center Pharmacy","group":"AlNainoon Alternative Medicine Center Pharmacy","type":"Hospital Pharmacy","area":"Al Hajar"}],"579":[{"name":"Al Jazira Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Al Janabiyah"},{"name":"Al-Dawaa Medical Services Pharmacy","group":"ALDAWAA PHARMACY","type":"Pharmacy","area":"Al Janabiyah"},{"name":"District Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Al Janabiyah"},{"name":"Heal Health and Wellness Pharmacy","group":"ALHAMAR PHARMACY","type":"Pharmacy","area":"Al Janabiya"}],"215":[{"name":"AlHilal Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Muharraq"},{"name":"Manama Pharmacy","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Muharraq"}],"428":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Al Seef"},{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Al Seef"},{"name":"Bahrain Health City Pharmacy","group":"BAHRAIN PHARMACY","type":"Hospital Pharmacy","area":"Al Seef"},{"name":"Boots Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Al Seef"},{"name":"The Eye Infirmary Pharmacy","group":"The Eye Infirmary Pharmacy","type":"Hospital Pharmacy","area":"Al Seef"},{"name":"Cairo Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Al Seef"},{"name":"Al-Hokail Specialist Medical Academic Clinics Pharmacy","group":"Al-Hokail Specialist Medical Academic Clinics Pharmacy","type":"Hospital Pharmacy","area":"Al Seef"},{"name":"Karisma Medical Center KMC Pharmacy","group":"Karisma Medical Center KMC Pharmacy","type":"Hospital Pharmacy","area":"Al Seef"}],"943":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Al Mazrowiah"}],"346":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Manama/Sea Front"},{"name":"Al Shaya Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Manama/Sea Front"},{"name":"Boots Avenues Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Manama/Sea Front"},{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Manama/Sea Front"},{"name":"Heal Health and wellness Pharmacy","group":"ALHAMAR PHARMACY","type":"Pharmacy","area":"Manama / Sea Front"},{"name":"Dermacare Skin and Laser Center Pharmacy","group":"Dermacare Skin and Laser Center Pharmacy","type":"Hospital Pharmacy","area":"Manama / Sea Front"}],"410":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Sanabis"}],"341":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Manama / AlJuffair"},{"name":"Heart of Juffair Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Manama / AlJuffair"}],"1014":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Al Hamala"},{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Al Hamalah"},{"name":"Badr Al Safaa Medical Centre Pharmacy","group":"Badr Al Safaa Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Al Hamalah"}],"527":[{"name":"Blisslab Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Sar"},{"name":"Hamad Town Pharmacy","group":"HTP","type":"Pharmacy","area":"Saar"}],"515":[{"name":"Delmon Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Sar"},{"name":"You Plus Sar Pharmacy","group":"HTP","type":"Pharmacy","area":"Sar"}],"328":[{"name":"Super Drug Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Manama/AlSuqayyah"},{"name":"Wael Pharmacy","group":"WAEL PHARMACY","type":"Pharmacy","area":"Manama/ Alsuqayyah"},{"name":"Dar AlSaha Medical Center Pharmacy","group":"Dar AlSaha Medical Center Pharmacy","type":"Pharmacy","area":"Manama/Alsuqayyah"},{"name":"University Medical Center Pharmacy","group":"University Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Manama/Suqayyah"},{"name":"Al Hilal Premier Hospital Saqia Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Manama / AlSuqayah"},{"name":"Well City Pharmacy","group":"WELLCARE PHARMACY","type":"Pharmacy","area":"Manama/AlSuqayyah"}],"258":[{"name":"First Amwaj Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Amwaj"},{"name":"Zad Pharmacy","group":"Zad Pharmacy","type":"Pharmacy","area":"Amwaj"}],"718":[{"name":"Isa Town Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Zayed Town"}],"324":[{"name":"Al Fateh Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Manama / AlFateh"},{"name":"National Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Manama / AlFateh"},{"name":"Bahrain Specialist Hospital Pharmacy","group":"Bahrain Specialist Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Al Fateh"},{"name":"Elite Medical Centre Pharmacy","group":"Elite Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Manama/AlFateh"},{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Manama/ AlFateh"},{"name":"Juffair Marina Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Manama / AlFateh"}],"224":[{"name":"Nasser Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Muharraq"},{"name":"Boots Bahrain Airport Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Muharraq"},{"name":"Gulf Air Medical Center Pharmacy","group":"Gulf Air Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Muharraq"}],"332":[{"name":"Nasser Pharmacy","group":"NASSER PHARMACY","type":"Pharmacy","area":"Manama/Bu Ashirah"},{"name":"Ibn Rushd Complex Pharmacy","group":"Ibn Rushd Complex Pharmacy","type":"Hospital Pharmacy","area":"Manama/BuAshirah"},{"name":"Jamila Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Manama / BuAshirah"},{"name":"New Pharmacy","group":"New Pharmacy","type":"Pharmacy","area":"Manama / BuAshira"},{"name":"DermaOne Medical Pharmacy","group":"DermaOne Medical Pharmacy","type":"Hospital Pharmacy","area":"Manama/BuAshirah"},{"name":"AlManal Eye Hospital Pharmacy","group":"AlManal Eye Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Buashirah"}],"929":[{"name":"GHM International Pharmacy","group":"GHM PHARMACY","type":"Pharmacy","area":"Riffa / AlHajiyat"},{"name":"Dawaa Al-Rifaa Pharmacy","group":"Dawaa Al-Rifaa Pharmacy","type":"Pharmacy","area":"Riffa / AlHajiyat"},{"name":"TopMed Pharmacy","group":"TopMed Pharmacy","type":"Pharmacy","area":"Riffa/AlHajiyat"}],"330":[{"name":"GHM International Pharmacy - ZINJ","group":"GHM PHARMACY","type":"Pharmacy","area":"Manama/BuGhazal"},{"name":"Modern Pharmacy","group":"HTP","type":"Pharmacy","area":"Manama / BuGhazal"},{"name":"Al Kindi Hospital Pharmacy","group":"HTP","type":"Hospital Pharmacy","area":"Manama /Bu Ghazal"}],"645":[{"name":"GHM International Pharmacy","group":"GHM PHARMACY","type":"Pharmacy","area":"Hawrat Sanad"},{"name":"Oxylife Pharmacy","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Hawrat Sanad"}],"734":[{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Aali"}],"1210":[{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Madinat Hamad"}],"611":[{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Al Hamriya"}],"411":[{"name":"Pharmacare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Al Musalla"},{"name":"Al Yari Pharmacy","group":"Al Yari Pharmacy","type":"Pharmacy","area":"Al Musalla"}],"236":[{"name":"WeCare Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Samaheej"},{"name":"Diamond Pharmacy","group":"DIAMOND PHARMACY","type":"Pharmacy","area":"Samaheej"},{"name":"Dar AlQudes Pharmacy","group":"HTP","type":"Pharmacy","area":"Samaheej"}],"304":[{"name":"Yateem Pharmacy","group":"Yateem Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Adam Pharmacy","group":"ADAM PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"AlBahar Pharmacy","group":"AlBahar Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"AlHessa Pharmacy","group":"ALEMARAH PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Rabeeh Manama Pharmacy","group":"HTP","type":"Pharmacy","area":"Manama Center"},{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Yousuf Mahmood Hussain Pharmacy","group":"YMH","type":"Pharmacy","area":"Manama Center"},{"name":"AlJihsi Pharmacy","group":"ALJISHI PHARMACY","type":"Pharmacy","area":"Manama Center"}],"913":[{"name":"AbdelRahman Pharmacy","group":"AbdelRahman Pharmacy","type":"Pharmacy","area":"Riffa/Bukowarah"},{"name":"Al Andalos Pharmacy","group":"Al Andalos Pharmacy","type":"Pharmacy","area":"Riffa/Bu Kowarah"},{"name":"Cigalah Pharmacy","group":"CIGALA PHARMACY","type":"Pharmacy","area":"Riffa/BuKowarah"},{"name":"Cairo Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Riffa / Bukowarah"},{"name":"Al Deera Pharmacy 2","group":"DEERA","type":"Pharmacy","area":"Riffa / Alhajiyat"}],"704":[{"name":"HopeWell Pharmacy","group":"HopeWell Pharmacy","type":"Pharmacy","area":"Salmabad"},{"name":"Ruyan Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Salmabad"},{"name":"Anbu Pharmacy","group":"ANBU PHARMACY","type":"Pharmacy","area":"Salmabad"},{"name":"Salman Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Salimabad"}],"469":[{"name":"AlAswad Pharmacy","group":"AlAswad Pharmacy","type":"Pharmacy","area":"Abu Sayba"}],"211":[{"name":"AlMahmeed Pharmacy","group":"AlMahmeed Pharmacy","type":"Pharmacy","area":"Muharraq Town"},{"name":"Al Hilal Hospital Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Muharraq Town"}],"1048":[{"name":"Shifa Dar Kulaib Pharmacy","group":"Shifa Dar Kulaib Pharmacy","type":"Pharmacy","area":"Dar Kulaib"}],"1025":[{"name":"Adam Pharmacy","group":"ADAM PHARMACY","type":"Pharmacy","area":"Karzakkan"}],"701":[{"name":"Adam Pharmacy","group":"ADAM PHARMACY","type":"Pharmacy","area":"Tubli"},{"name":"AlBuraq Pharmacy","group":"AlBuraq Pharmacy","type":"Pharmacy","area":"Tubli"}],"252":[{"name":"Adam Pharmacy","group":"ADAM PHARMACY","type":"Pharmacy","area":"Qalali"}],"308":[{"name":"Adliyah Pharmacy","group":"Adliyah Pharmacy","type":"Pharmacy","area":"Manama / AlQudaybiyah"},{"name":"Alpha Pharmacy","group":"Alpha Pharmacy","type":"Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"Al Qamar Pharmacy","group":"ALQAMAR PHARMACY","type":"Pharmacy","area":"Manama / AlQudaybiyah"}],"580":[{"name":"A1 Pharmacy","group":"A1 Pharmacy","type":"Pharmacy","area":"Salman Town"}],"604":[{"name":"AlBayan Medical Centre Pharmacy","group":"AlBayan Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Al Qaryah"},{"name":"Anbu Pharmacy","group":"ANBU PHARMACY","type":"Pharmacy","area":"Al Qaryah"},{"name":"Bait Al-Dawaa Pharmacy","group":"Bait Al-Dawaa Pharmacy","type":"Pharmacy","area":"Al Qaryah"},{"name":"You Plus Sitra Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Qaryah"}],"263":[{"name":"Diyar Pharmacy","group":"LAMYAA MEDICAL CENTER","type":"Pharmacy","area":"Diyar AlMuharraq"},{"name":"Well Being Pharmacy","group":"WELL BEING PHARMACY","type":"Pharmacy","area":"Diyar Al Muharraq"}],"721":[{"name":"AlRabea Pharmacy","group":"AlRabea Pharmacy","type":"Pharmacy","area":"Jid Ali"},{"name":"AlAtheer Pharmacy","group":"AlAtheer Pharmacy","type":"Pharmacy","area":"Jidd Ali"}],"705":[{"name":"Mishkat Pharmacy","group":"AlRabea Pharmacy","type":"Pharmacy","area":"Tubli"}],"914":[{"name":"Vaidyaratnam Ayurvedic Health Centre Pharmacy","group":"Vaidyaratnam Ayurvedic Health Centre Pharmacy","type":"Hospital Pharmacy","area":"Riffa / Al Shamali"},{"name":"Riffa Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Riffa/Al Shamali"},{"name":"Beauty and Health Pharmacy","group":"Beauty and Health Pharmacy","type":"Pharmacy","area":"Riffa/AlShamali"}],"941":[{"name":"Sihati Pharmacy","group":"Sihati Pharmacy","type":"Pharmacy","area":"Riffa / Al Buhair"},{"name":"Rose Pharmacies","group":"ROSE PHARMACY","type":"Pharmacy","area":"Riffa/Al Buhair"},{"name":"AlSalam Specialist Hospital Pharmacy","group":"AlSalam Specialist Hospital Pharmacy","type":"Hospital Pharmacy","area":"Riffa/Al Buhair"},{"name":"Aster Medical Center Sanad Pharmacy","group":"ASTER MEDICAL CENTER","type":"Hospital Pharmacy","area":"Riffa / Al Buhair"},{"name":"Spectra Medical and Pharmaceutical Pharmacy","group":"Spectra Medical and Pharmaceutical Pharmacy","type":"Pharmacy","area":"Riffa-Al buhair"}],"254":[{"name":"Pharmica Pharmacy","group":"Pharmica Pharmacy","type":"Pharmacy","area":"Qalali"}],"412":[{"name":"You Plus Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Daih"}],"113":[{"name":"Stepps Pharmacy","group":"Stepps Pharmacy","type":"Pharmacy","area":"Hidd"},{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Hidd"}],"321":[{"name":"Bluebird Pharmacy","group":"BLUE BIRD PHARMACY","type":"Pharmacy","area":"AlQudaybiyah"},{"name":"Anbu Pharmacy","group":"ANBU PHARMACY","type":"Pharmacy","area":"Manama / AlQudaybiyah"},{"name":"Behzad Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Manama/Al Qudaibiya"},{"name":"BRSV Pharmacy","group":"Kriya PHARMACY","type":"Pharmacy","area":"Manama / Alqudaybiyah"},{"name":"Mrithu Pharmacy","group":"MRITHU PHARMACY","type":"Pharmacy","area":"Manama / AlQudaybiyah"},{"name":"Bu Ammar Pharmacy","group":"Bu Ammar Pharmacy","type":"Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"Organicare Pharmacy","group":"Organicare Pharmacy","type":"Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"Aster Medical Center Bahrain Pharmacy","group":"ASTER MEDICAL CENTER","type":"Hospital Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"Happy Pharmacy","group":"HAPPY PHARMACY","type":"Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"Vmega Pharmacy","group":"Vmega Pharmacy","type":"Pharmacy","area":"Manama/AlQudaybiyah"},{"name":"AlAtheer Pharmacy","group":"AlAtheer Pharmacy","type":"Pharmacy","area":"Manama / AlQudaybiyah"}],"939":[{"name":"Remedy Zone Pharmacy","group":"Remedy Zone Pharmacy","type":"Pharmacy","area":"Riffa-AlHajiyat"},{"name":"Ingenuity Pharmacy","group":"Ingenuity Pharmacy","type":"Pharmacy","area":"Riffa / Alhajiyat"},{"name":"Danaat AlMadina Pharmacy","group":"BLU SKY PHARMACY","type":"Pharmacy","area":"Riffa / AlHajiyat"},{"name":"Oxygen Pharmacy","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Riffa/AlHajiyat"},{"name":"Al Amana Pharmacy","group":"Al Amana Pharmacy","type":"Pharmacy","area":"Riffa/AlHajiyat"},{"name":"Pharmaaid Pharmacy","group":"Pharmaaid Pharmacy","type":"Pharmacy","area":"Riffa/AlHajiyat"}],"302":[{"name":"Care Cure Pharmacy","group":"Care Cure Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Care Cure Pharmacy","group":"Care Cure Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Elements Pharmacy","group":"Elements Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Danaat AlMadina Pharmacy","group":"BLU SKY PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Mrithu Pharmacy","group":"MRITHU PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Mrithu Pharmacy","group":"MRITHU PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Netmed Pharmacy","group":"Netmed Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Selva Pharmacy","group":"Selva Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Vikas Pharmacy","group":"Vikas Pharmacy","type":"Pharmacy","area":"Manama/Al Qudaybiyah"}],"307":[{"name":"Dr Abdulla Kamal Medical Centre Pharmacy","group":"Dr Abdulla Kamal Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Manama Center"},{"name":"Manama Pharmacy","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"American Mission Hospital Pharmacy","group":"AMERICAN MISSION HOSPITAL","type":"Hospital Pharmacy","area":"Manama Center"},{"name":"Forooghi Pharmacy","group":"Forooghi Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Tariq Pharmacy","group":"Tariq Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"Vikas Pharmacy","group":"Vikas Pharmacy","type":"Pharmacy","area":"Manama Center"}],"356":[{"name":"AlDafter Medical Center Pharmacy","group":"AlDafter Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Salihiya"}],"318":[{"name":"ALEMARAH PHARMACY","group":"ALEMARAH PHARMACY","type":"Pharmacy","area":"Manama-AlHoora"},{"name":"Anbu Pharmacy","group":"ANBU PHARMACY","type":"Pharmacy","area":"Manama/AlHoora"},{"name":"AlDana Pharmacy","group":"AlDana Pharmacy","type":"Pharmacy","area":"Manama/Al Hoora"},{"name":"PureHealth Pharmacy","group":"PureHealth Pharmacy","type":"Pharmacy","area":"Manama/AlHoora"},{"name":"Dr.Fatheya Almulla Homeopathic Unit Pharmacy","group":"Dr.Fatheya Almulla Homeopathic Unit Pharmacy","type":"Hospital Pharmacy","area":"Manama/AlHoora"},{"name":"Dar Al-Shifa Medical Centre Pharmacy","group":"Dar Al-Shifa Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Manama/ AlHoora"}],"608":[{"name":"AlEmarah Pharmacy","group":"ALEMARAH PHARMACY","type":"Pharmacy","area":"Wadiyan"},{"name":"Al Hilal Multi Specialty Medical Center Sitra Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Wadiyan"}],"212":[{"name":"Al Manar Pharmacy","group":"Al Manar Pharmacy","type":"Pharmacy","area":"Muharraq"}],"228":[{"name":"Crown Pharmacy","group":"CROWN PHARMACY","type":"Pharmacy","area":"Al Sayh"},{"name":"Dimensions Pharmacy","group":"Dimensions Pharmacy","type":"Pharmacy","area":"Al Sayh"},{"name":"Yousuf Mahmood Hussain and Bahrain Pharmacy","group":"YMH","type":"Pharmacy","area":"Al Sayah"},{"name":"HiCare Medical Center Pharmacy","group":"HiCare Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Al Sayh"},{"name":"Tulsi Compounding Pharmacy","group":"Tulsi Compounding Pharmacy","type":"Pharmacy","area":"Al Sayh"},{"name":"Rx Pharmacy","group":"Rx Pharmacy","type":"Pharmacy","area":"Al Sayh"}],"306":[{"name":"Al Noor Pharmacy","group":"Al Noor Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"AlDeerah Pharmacy","group":"DEERA","type":"Pharmacy","area":"Manama Center"}],"1203":[{"name":"Dar Alshifa Pharmacy","group":"ALRAHMA PHARMACY","type":"Pharmacy","area":"Madinat Hamad"},{"name":"Rabeeh Hamad Town Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"},{"name":"You Plus Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"},{"name":"Hamad Town Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"},{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"},{"name":"University Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Hamad Town"},{"name":"Al Hilal Multispecialty Medical Center Hamad Town Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Madinat Hamad"},{"name":"Safa Makkaha Pharmacy","group":"Safa Makkaha Pharmacy","type":"Pharmacy","area":"Madinat Hamad"}],"812":[{"name":"Al Rahma Pharmacy","group":"ALRAHMA PHARMACY","type":"Pharmacy","area":"Isa Town"},{"name":"Modern Pharmacy","group":"HTP","type":"Pharmacy","area":"Isa Town"},{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Isa Town"},{"name":"Salman Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Isa Town"}],"206":[{"name":"Sarah Pharmacy","group":"HAPPY PHARMACY","type":"Pharmacy","area":"Muharraq"}],"257":[{"name":"Top Island Pharmacy","group":"Top Island Pharmacy","type":"Pharmacy","area":"Amwaj"},{"name":"American Mission Hospital Pharmacy Amwaj","group":"AMERICAN MISSION HOSPITAL","type":"Hospital Pharmacy","area":"Amwaj"}],"253":[{"name":"AlSafwa Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Qalali"},{"name":"AlHakeem Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Qalali"}],"915":[{"name":"Meds Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Riffa / Al Shamali"},{"name":"Glow By Nadhara Pharmacy","group":"Glow By Nadhara Pharmacy","type":"Pharmacy","area":"Riffa/Al Shamali"},{"name":"American Mission Hospital Pharmacy","group":"AMERICAN MISSION HOSPITAL","type":"Hospital Pharmacy","area":"Riffa/Al Shamali"},{"name":"Heebaa Pharmacy","group":"Heebaa Pharmacy","type":"Pharmacy","area":"Riffa/AlShargi"}],"450":[{"name":"Jaffar Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Al Maqsha"}],"319":[{"name":"Jaffar Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Manama/Al Hoora"},{"name":"Good Life Pharmacy","group":"Good Life Pharmacy","type":"Pharmacy","area":"Manama / AlHoora"},{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Manama-AlHoora"}],"327":[{"name":"Leena Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Manama/Al Adliya"},{"name":"Al Hilal Multi Specialty Medical Center Manama Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Manama / Al Adliyah"},{"name":"Al Hilal Medical Center for Women and Children Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Manama/Al Adliyah"}],"203":[{"name":"Majeed Jaffar Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Muharraq Town"}],"745":[{"name":"National Pharmacy","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Sanad"},{"name":"Wael Pharmacy","group":"WAEL PHARMACY","type":"Pharmacy","area":"Sanad"},{"name":"Sanad 2 Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Sanad"},{"name":"AlHoda Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Sanad"},{"name":"AlDeerah Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Sanad"},{"name":"Dar Al Sanad Pharmacy","group":"Dar Al Sanad Pharmacy","type":"Pharmacy","area":"Sanad"}],"624":[{"name":"Anbu Pharmacy","group":"ANBU PHARMACY","type":"Pharmacy","area":"Al Akr Al Gharbi"},{"name":"Jannusan Pharmacy","group":"JANUSSAN PHARMACY","type":"Pharmacy","area":"Al Akr Al Gharbi"}],"303":[{"name":"Vital Pharmacy","group":"Vital Pharmacy","type":"Pharmacy","area":"Manama / AlNai'm"},{"name":"Bu Ammar Pharmacy","group":"Bu Ammar Pharmacy","type":"Pharmacy","area":"Manama/AlNai'm"},{"name":"Al Wafa Pharmacy","group":"Al Wafa Pharmacy","type":"Pharmacy","area":"Manama / Al Nai'm"}],"336":[{"name":"Al Baraka Fertility Hospital Pharmacy","group":"Al Baraka Fertility Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Al Adliya"}],"1022":[{"name":"Asma Pharmacy","group":"ASMAA PHARMACY","type":"Pharmacy","area":"Damistan"},{"name":"You Plus Dimstan Pharmacy","group":"HTP","type":"Pharmacy","area":"Damistan"}],"1032":[{"name":"Rehana Pharmacy","group":"ASMAA PHARMACY","type":"Pharmacy","area":"Malkiya"},{"name":"Bahrain Pharmacy& General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Malkiya"},{"name":"Malkiya Pharmacy","group":"PHARMACARE PHARMACY","type":"Pharmacy","area":"Malkiya"}],"732":[{"name":"Curewell Pharma Pharmacy","group":"Curewell Pharma Pharmacy","type":"Pharmacy","area":"A'Ali"},{"name":"You Plus Pharmacy","group":"HTP","type":"Pharmacy","area":"A'Ali"},{"name":"Ola Pharmacy","group":"Ola Pharmacy","type":"Pharmacy","area":"A'Ali"},{"name":"King Hamad American Mission Hospital Pharmacy","group":"King Hamad American Mission Hospital Pharmacy","type":"Hospital Pharmacy","area":"A'ali"}],"738":[{"name":"AlSadiq Pharmacy","group":"AWAL PHARMACY","type":"Pharmacy","area":"A'Ali"},{"name":"A1 Pharmacy","group":"A1 Pharmacy","type":"Pharmacy","area":"A'Ali"}],"901":[{"name":"Awal Pharmacy","group":"AWAL PHARMACY","type":"Pharmacy","area":"Riffa/Al Hunainiyah"},{"name":"Target Pharmacy","group":"Target Pharmacy","type":"Pharmacy","area":"Riffa/AlHunayniyah"}],"240":[{"name":"Boots AlMuharraq Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Arad"},{"name":"Fort Pharmacy","group":"FORT PHARMACY","type":"Pharmacy","area":"Arad"}],"928":[{"name":"Boots Wadi Al Sail Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Riffa/Wadi AlSail"},{"name":"Durrat Riffa Pharmacy","group":"DURRAT PHARMACY","type":"Pharmacy","area":"Riffa/Wadi AlSail"}],"329":[{"name":"Al Bader Pharmacy","group":"Al Bader Pharmacy","type":"Pharmacy","area":"Manama/Al Salmaniya"},{"name":"AlShamel Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Manama / AlSalmaniya"},{"name":"Well Being Pharmacy","group":"WELL BEING PHARMACY","type":"Pharmacy","area":"Manama / AlSalmaniya"},{"name":"Community Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Manama / AlSalmaniya"},{"name":"Royal Bahrain Hospital Pharmacy","group":"Royal Bahrain Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Al Salmaniya"},{"name":"Gulf Medical and Diabetes Center Pharmacy","group":"Gulf Medical and Diabetes Center Pharmacy","type":"Hospital Pharmacy","area":"Manama / AlSalmaniya"}],"803":[{"name":"Cairo Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Isa Town"}],"1046":[{"name":"University Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Dar Kulaib"},{"name":"Jannusan Pharmacy","group":"JANUSSAN PHARMACY","type":"Pharmacy","area":"Dar Kulaib"}],"908":[{"name":"Balsam Pharmacy","group":"TADAWI PHARMACY","type":"Pharmacy","area":"Riffa / AlGharbi"}],"925":[{"name":"Boots Al Riffa Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Riffa/BuKowarah"},{"name":"Life Care Pharmacy","group":"LIFE CARE PHARMACY","type":"Pharmacy","area":"Riffa/BuKowarah"},{"name":"Shefaee Pharmacy","group":"Shefaee Pharmacy","type":"Pharmacy","area":"Riffa/BuKowarah"},{"name":"Al Shams Pharmacy","group":"Al Shams Pharmacy","type":"Pharmacy","area":"Riffa/BuKowarah"},{"name":"Health Point Pharmacy","group":"Health Point Pharmacy","type":"Pharmacy","area":"Riffa/BuKowarah"}],"575":[{"name":"Boots ElMercado Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Al Janabiya"},{"name":"Yousuf Mahmood Hussain Pharmacy","group":"YMH","type":"Pharmacy","area":"Al Janabiyah"},{"name":"Janabiyah Square Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Janabiyah"},{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Janabiyah"}],"933":[{"name":"Boots Oasis Pharmacy","group":"BOOTS","type":"Pharmacy","area":"Riffa/Al Buhair"},{"name":"Gulf Remedies Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Riffa/Al Buhair"}],"552":[{"name":"Dr. Behzad Pharmacy","group":"DR BEHZAD PHARMACY","type":"Pharmacy","area":"Budaiya"},{"name":"Naib Pharmacy","group":"Naib Pharmacy","type":"Pharmacy","area":"Budaiya"}],"223":[{"name":"Airport Avenue Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Busaiteen"}],"1057":[{"name":"AlWatan Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Zallaq"}],"810":[{"name":"Family Pharmacy","group":"BEHZAD PHARMACY","type":"Pharmacy","area":"Isa Town"},{"name":"Bucare Pharmacy","group":"Black Sea Pharmacy","type":"Pharmacy","area":"Isa Town"}],"708":[{"name":"Be Well Pharmacy","group":"Be Well Pharmacy","type":"Pharmacy","area":"Salmabad"},{"name":"Al Hilal Multi Specialty Medical Center Salmabad Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Salimabad"}],"364":[{"name":"RAM Medical Center Pharmacy","group":"RAM Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Bilad Al Qadeem"},{"name":"Diamond Pharmacy","group":"DIAMOND PHARMACY","type":"Pharmacy","area":"Bilad Al Qadeem"}],"806":[{"name":"Black Sea Pharmacy & General Trading","group":"Black Sea Pharmacy","type":"Pharmacy","area":"Isa Town"}],"204":[{"name":"BlueBird Pharmacy","group":"BLUE BIRD PHARMACY","type":"Pharmacy","area":"Muharraq"}],"932":[{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Riffa/AlGharbi"},{"name":"Socrates Medical Company Pharmacy","group":"Socrates Medical Company Pharmacy","type":"Pharmacy","area":"Riffa / AlGharbi"}],"957":[{"name":"Well Being Pharmacy","group":"WELL BEING PHARMACY","type":"Pharmacy","area":"Jau"},{"name":"Rose Pharmacies - Asker Branch","group":"ROSE PHARMACY","type":"Pharmacy","area":"Jau"},{"name":"AlDeerah Pharmacy","group":"DEERA","type":"Pharmacy","area":"Jau"}],"923":[{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Riffa / BuKowarah"}],"315":[{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Manama Center"},{"name":"Square Pharmacy","group":"Square Pharmacy","type":"Pharmacy","area":"Manama Center"},{"name":"AlHilal Medical Center Manama Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Manama Center"}],"255":[{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Busaiteen"},{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Qalali"},{"name":"AlDeerah Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Qalali"}],"1020":[{"name":"Bahrain Pharmacy and General Store","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Al Lawzi"}],"320":[{"name":"Kriya Pharmacy","group":"Kriya PHARMACY","type":"Pharmacy","area":"Manama / AlHoora"}],"358":[{"name":"Evexia One Day Surgery Hospitals & Clinics Pharmacy","group":"Evexia One Day Surgery Hospitals & Clinics Pharmacy","type":"Hospital Pharmacy","area":"Zinj"},{"name":"Shuwaikh Derma and Laser Center Pharmacy","group":"Shuwaikh Derma and Laser Center Pharmacy","type":"Hospital Pharmacy","area":"Zinj"}],"960":[{"name":"Serene Resort for Psychiatry and Addiction Treatment Pharmacy","group":"ROSE PHARMACY","type":"Hospital Pharmacy","area":"Jau"}],"626":[{"name":"Al Furqan Pharmacy","group":"Al Furqan Pharmacy","type":"Pharmacy","area":"Al Akr Al Gharbi"}],"264":[{"name":"Crown Pharmacy","group":"CROWN PHARMACY","type":"Pharmacy","area":"Diyar Al Muharraq"},{"name":"Yousuf Mahmood Hussain Pharmacy","group":"YMH","type":"Pharmacy","area":"Diyar Al Muharraq"},{"name":"You Plus Pharmacy","group":"HTP","type":"Pharmacy","area":"Diyar Al Muharraq"},{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Diyar Al Muharraq"},{"name":"University Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Diyar Al Muharraq"}],"373":[{"name":"Dr. Haitham AlQari Center Pharmacy","group":"Dr. Haitham AlQari Center Pharmacy","type":"Hospital Pharmacy","area":"Manama / Bu Ghazal"},{"name":"Dr. Salam Jibrel Medical Center Pharmacy","group":"Dr. Salam Jibrel Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Manama / BuGhazal"},{"name":"Dr. Haifa Eye Hospital Pharmacy","group":"Dr. Haifa Eye Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama / Bu Ghazal"},{"name":"MC Master Clinics Pharmacy","group":"MC Master Clinics Pharmacy","type":"Pharmacy","area":"Manama / BuGhazal"}],"814":[{"name":"Resala International Pharmacy","group":"Resala International Pharmacy","type":"Pharmacy","area":"Isa Town"},{"name":"ALRAHMA PHARMACY","group":"ALRAHMA PHARMACY","type":"Pharmacy","area":"ISA TOWN"},{"name":"Future Pharmacy","group":"Future Pharmacy","type":"Pharmacy","area":"Isa Town"}],"966":[{"name":"Diamond Pharmacy","group":"DIAMOND PHARMACY","type":"Pharmacy","area":"Madinat Khalifa"}],"408":[{"name":"Durrat Sanabis Pharmacy","group":"DURRAT PHARMACY","type":"Pharmacy","area":"Sanabis"}],"359":[{"name":"Dar Al Fouad Pharmacy","group":"Dar Al Fouad Pharmacy","type":"Pharmacy","area":"Zinj"}],"1033":[{"name":"Teriaq Pharmacy","group":"Teriaq Pharmacy","type":"Pharmacy","area":"Malkiya"}],"360":[{"name":"AlFardan Medical Center Pharmacy","group":"AlFardan Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Zinj"},{"name":"Dr Khulood Al Darazi Medical Centre Pharmacy","group":"Dr Khulood Al Darazi Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Zinj"},{"name":"Stanford Medical Center Pharmacy","group":"Stanford Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Zinj"}],"545":[{"name":"AmanCare Group of Pharmacies","group":"AmanCare Group of Pharmacies","type":"Pharmacy","area":"Al Qurayyah"}],"917":[{"name":"Dr Dhia Medical Center Pharmacy","group":"Dr Dhia Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Riffa/Bukowarah"}],"907":[{"name":"Sabr Pharmacy","group":"Sabr Pharmacy","type":"Pharmacy","area":"Riffa/AlShargi"},{"name":"AlDeerah Pharmacy","group":"DEERA","type":"Pharmacy","area":"Riffa/AlShargi"}],"513":[{"name":"Al Nakheel Medical Centre Pharmacy","group":"Al Nakheel Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Maqabah"},{"name":"Manama Pharmacy","group":"BAHRAIN PHARMACY","type":"Pharmacy","area":"Maqabah"}],"109":[{"name":"Al Suwaifiyah Pharmacy","group":"YMH","type":"Pharmacy","area":"Hidd"},{"name":"TABARAK Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Hidd"},{"name":"Hidd Life Care Pharmacy","group":"LIFE CARE PHARMACY","type":"Pharmacy","area":"Hidd"}],"714":[{"name":"Yousuf Mahmood Hussain Pharmacy","group":"YMH","type":"Pharmacy","area":"Hawrat Aali"}],"242":[{"name":"Duaa Pharmacy","group":"Duaa Pharmacy","type":"Pharmacy","area":"Arad"},{"name":"Arad Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Arad"}],"919":[{"name":"Faa Pharmacy","group":"White Pharmacy","type":"Pharmacy","area":"Riffa / BuKowarah"}],"434":[{"name":"Faiza Pharmacy","group":"ASMAA PHARMACY","type":"Pharmacy","area":"Karbabad"}],"1010":[{"name":"Afiya Pharmacy","group":"ASMAA PHARMACY","type":"Pharmacy","area":"Al Hamala"}],"945":[{"name":"Mohammed Bin Khalifa Cardiac Center Pharmacy","group":"Mohammed Bin Khalifa Cardiac Center Pharmacy","type":"Hospital Pharmacy","area":"Awali"},{"name":"Awali Hospital Pharmacy","group":"Awali Hospital Pharmacy","type":"Hospital Pharmacy","area":"Awali"},{"name":"Saiba Pharmacy","group":"Saiba Pharmacy","type":"Pharmacy","area":"Awali"}],"540":[{"name":"Al Quds Pharmacy","group":"Al Quds Pharmacy","type":"Pharmacy","area":"Al Diraz"}],"222":[{"name":"Paradise Pharmacy","group":"Paradise Pharmacy","type":"Pharmacy","area":"Busaiteen"},{"name":"Mrithu Pharmacy","group":"MRITHU PHARMACY","type":"Pharmacy","area":"Busaiteen"}],"244":[{"name":"Farah Pharmacy","group":"Farah Pharmacy","type":"Pharmacy","area":"Arad"},{"name":"Durrat Arad Pharmacy","group":"DURRAT PHARMACY","type":"Pharmacy","area":"Arad"}],"720":[{"name":"Fort Pharmacy (Zayed Town)","group":"FORT PHARMACY","type":"Pharmacy","area":"Zayed Town"},{"name":"Al-Dawaa Medical Services Pharmacy","group":"ALDAWAA PHARMACY","type":"Pharmacy","area":"Zayed Town"}],"362":[{"name":"Global Dermatology Centre Pharmacy","group":"Global Dermatology Centre Pharmacy","type":"Hospital Pharmacy","area":"Bilad Al Qadeem"},{"name":"AlMosawi Specialist Center Pharmacy","group":"AlMosawi Specialist Center Pharmacy","type":"Hospital Pharmacy","area":"Bilad Al Qadeem"}],"903":[{"name":"Gouranga Ayurvedic Centre Pharmacy","group":"Gouranga Ayurvedic Centre Pharmacy","type":"Hospital Pharmacy","area":"Riffa/AlHunayniyah"},{"name":"Jasmine Pharmacy","group":"JANUSSAN PHARMACY","type":"Pharmacy","area":"Riffa - Alhunayniyah"},{"name":"Al Hilal Multi Specialty Medical Center Riffa Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Riffa/AlHunayniyah"},{"name":"Al Qamar Pharmacy","group":"ALQAMAR PHARMACY","type":"Pharmacy","area":"Riffa/AlHunayniyah"}],"742":[{"name":"Green Apple Pharmacy","group":"Green Apple Pharmacy","type":"Pharmacy","area":"A'Ali"},{"name":"Al Atheed Pharmacy","group":"Al Atheed Pharmacy","type":"Pharmacy","area":"A'ali"}],"108":[{"name":"Harvey International Pharmacy","group":"Harvey International Pharmacy","type":"Pharmacy","area":"Hidd"}],"301":[{"name":"Hashim Pharmacy","group":"Hashim Pharmacy","type":"Pharmacy","area":"Manama Center"}],"1209":[{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"}],"317":[{"name":"Hamad Town Pharmacy","group":"HTP","type":"Pharmacy","area":"Diplomatic Area"}],"729":[{"name":"Al Nahar Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Jerdab"},{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Jerdab"}],"743":[{"name":"Sanad Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Sanad"}],"816":[{"name":"AlHoda Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Isa Town"}],"555":[{"name":"AlHoda Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Budaiya"}],"711":[{"name":"AlHoda Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Tubli"},{"name":"Gulf Pharmacies","group":"GULF PHARMACY","type":"Pharmacy","area":"Tubli"},{"name":"Yousuf Mahmood Hussain Pharmacy","group":"YMH","type":"Pharmacy","area":"Tubli"},{"name":"IMA Medical Center Pharmacy","group":"IMA Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Tubli"},{"name":"Tubli Pharmacy","group":"Tubli Pharmacy","type":"Pharmacy","area":"Tubli"}],"1017":[{"name":"Damistan Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Damistan"}],"112":[{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Hidd"},{"name":"Al Hilal Multispecialty Medical Center Hidd Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Hidd"}],"571":[{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Al Janabiyah"},{"name":"Salma Pharmacy","group":"SALMA PHARMACY KIMS","type":"Pharmacy","area":"Al Janabiyah"},{"name":"RBH Medical Center Pharmacy","group":"RBH Medical Center Pharmacy","type":"Pharmacy","area":"Al Janabiyah"}],"904":[{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Riffa/AlGharbi"}],"426":[{"name":"Tabarak Pharmacy","group":"TABARAK PHARMACY","type":"Pharmacy","area":"Jidhafs"},{"name":"Dar Al Hayat Pharmacy","group":"HTP","type":"Pharmacy","area":"Jid Hafs"}],"205":[{"name":"AlMowasah Pharmacy","group":"AlMowasah Pharmacy","type":"Pharmacy","area":"Muharraq"}],"911":[{"name":"Al Seha Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Riffa - Alshargi"},{"name":"Al Rayan Medical Complex Pharmacy","group":"Al Rayan Medical Complex Pharmacy","type":"Hospital Pharmacy","area":"Riffa/AlShargi"},{"name":"Habeba Medical Care Pharmacy","group":"Habeba Medical Care Pharmacy","type":"Pharmacy","area":"Riffa/AlShargi"}],"525":[{"name":"Diyar Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Sar"}],"517":[{"name":"Saar Centre Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Saar"}],"243":[{"name":"Ibn Sina Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Arad"}],"345":[{"name":"Juffair Square Pharmacy","group":"GULF PHARMACY","type":"Pharmacy","area":"Manama/AlJuffair"},{"name":"Serene Psychiatry Hospital Pharmacy","group":"ROSE PHARMACY","type":"Hospital Pharmacy","area":"Manama/AlJuffair"}],"801":[{"name":"Ibn Sina Medical Center Pharmacy","group":"Ibn Sina Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Isa Town"}],"927":[{"name":"International Medical Centre Pharmacy","group":"International Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Riffa/Bu Kowarah"},{"name":"Marina Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Riffa/Bu Kowarah"},{"name":"Yaseen Pharmacy","group":"Yaseen Pharmacy","type":"Pharmacy","area":"Riffa/BuKowarah"}],"333":[{"name":"Ibn Al-Nafees Hospital Pharmacy","group":"Ibn Al-Nafees Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Um Al Hassam"},{"name":"Srisoukya Pharmacy","group":"Srisoukya Pharmacy","type":"Hospital Pharmacy","area":"Manama/Umm AlHassam"},{"name":"Srisoukya Pharmacy","group":"Srisoukya Pharmacy","type":"Hospital Pharmacy","area":"Manama/ Umm AlHassam"},{"name":"Zhan Dental and Orthodontic Center Pharmacy","group":"Zhan Dental and Orthodontic Center Pharmacy","type":"Hospital Pharmacy","area":"Manama/Umm AlHassam"},{"name":"Dr. Tariq Hospital Pharmacy","group":"Dr. Tariq Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama/Um Al Hassam"}],"422":[{"name":"Al Hikma Pharmacy","group":"HTP","type":"Pharmacy","area":"Jidhafs Town"}],"536":[{"name":"You Plus Al Diraz Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Diraz"}],"229":[{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Sayh"}],"1218":[{"name":"You Plus One Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"}],"526":[{"name":"You Plus Barbar Pharmacy","group":"HTP","type":"Pharmacy","area":"Bar Bar"}],"419":[{"name":"You Plus Gardenia Pharmacy","group":"HTP","type":"Pharmacy","area":"JidHafs"}],"934":[{"name":"You Plus AlBahair Pharmacy","group":"HTP","type":"Pharmacy","area":"Riffa / Al Shamali"},{"name":"Casa De Med Pharmacy","group":"Casa De Med Pharmacy","type":"Hospital Pharmacy","area":"Riffa / Al Shamali"}],"202":[{"name":"PH7 Pharmacy","group":"HTP","type":"Pharmacy","area":"Muharraq"}],"1034":[{"name":"AlSalam Pharmacy","group":"HTP","type":"Pharmacy","area":"Malkiya"}],"231":[{"name":"You Plus Al Dair Pharmacy","group":"HTP","type":"Pharmacy","area":"Al Dair"}],"481":[{"name":"Dar AlHekma Pharmacy","group":"HTP","type":"Pharmacy","area":"Shakhurah"}],"1215":[{"name":"Dar AlHekma Pharmacy","group":"HTP","type":"Pharmacy","area":"Madinat Hamad"}],"226":[{"name":"University Pharmacy","group":"ALDEERA PHARMACY","type":"Pharmacy","area":"Busaiteen"}],"110":[{"name":"AlDeerah Pharmacy","group":"DEERA","type":"Pharmacy","area":"Hidd"},{"name":"Oxygen Pharmacy","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Hidd"},{"name":"Middle East Medical Center Pharmacy","group":"Middle East Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Hidd"}],"447":[{"name":"AlRazi Pharmacy","group":"ALRAZI PHARMACY","type":"Pharmacy","area":"Al Qadam"}],"746":[{"name":"AlRazi Pharmacy","group":"ALRAZI PHARMACY","type":"Pharmacy","area":"A'Ali"}],"414":[{"name":"AlRazi Pharmacy","group":"ALRAZI PHARMACY","type":"Pharmacy","area":"Al-Daih"}],"1038":[{"name":"AlRazi Pharmacy","group":"ALRAZI PHARMACY","type":"Pharmacy","area":"Sadad"},{"name":"Marina Hamad Town Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Sadad"}],"105":[{"name":"Dar Al-Shifa Medical Centre Pharmacy","group":"Dar Al-Shifa Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Hidd"}],"514":[{"name":"Hamza Pharmacy","group":"Hamza Pharmacy","type":"Pharmacy","area":"Jid Al Haj"}],"605":[{"name":"Hamza Pharmacy","group":"Hamza Pharmacy","type":"Pharmacy","area":"Murqoban"}],"207":[{"name":"Lifemed Pharmacy","group":"Lifemed Pharmacy","type":"Pharmacy","area":"Muharraq"},{"name":"KimsHealth Medical Center Pharmacy","group":"KIMS HOSPITAL","type":"Hospital Pharmacy","area":"Muharraq"}],"361":[{"name":"Nooh Pharmacy","group":"NOOH PHARMACY","type":"Pharmacy","area":"Bilad Al Qadeem"}],"460":[{"name":"Nooh Pharmacy","group":"NOOH PHARMACY","type":"Pharmacy","area":"Karranah"}],"337":[{"name":"Salma Pharmacy","group":"SALMA PHARMACY KIMS","type":"Pharmacy","area":"Manama/Umm Alhassam"},{"name":"Saiba Pharmacy","group":"Saiba Pharmacy","type":"Pharmacy","area":"Manama/Umm AlHassam"}],"952":[{"name":"Salma Pharmacy","group":"SALMA PHARMACY KIMS","type":"Pharmacy","area":"Ras Zuwayed"},{"name":"Al Hilal Medical Center Pharmacy","group":"ALHILAL HOSPITAL","type":"Hospital Pharmacy","area":"Ras Zuwayed"},{"name":"Revive Pharmacy","group":"Revive Pharmacy","type":"Pharmacy","area":"Ras Zuwayed"},{"name":"Roots Pharmacy","group":"Roots Pharmacy","type":"Pharmacy","area":"Ras Zuwayed"}],"457":[{"name":"Sulwan Psychiatric Hospital Pharmacy","group":"Sulwan Psychiatric Hospital Pharmacy","type":"Hospital Pharmacy","area":"Bu Quwah"},{"name":"Oxygen Pharmacy","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Bu Quwah"}],"809":[{"name":"Dr. Jamal Al Zeera Medical Centre Pharmacy","group":"Dr. Jamal Al Zeera Medical Centre Pharmacy","type":"Hospital Pharmacy","area":"Isa Town"}],"606":[{"name":"Jannusan Pharmacy","group":"JANUSSAN PHARMACY","type":"Pharmacy","area":"Al Kharijiyah"}],"905":[{"name":"Jayant Pharmacy","group":"Jayant Pharmacy","type":"Pharmacy","area":"Riffa / AlShargi"},{"name":"Afeef Pharmacy","group":"Afeef Pharmacy","type":"Pharmacy","area":"Riffa/AlShargi"},{"name":"Al Qamar Pharmacy","group":"ALQAMAR PHARMACY","type":"Pharmacy","area":"Riffa/AlShargi"}],"636":[{"name":"Bapco Medical Center Pharmacy","group":"Bapco Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Al Maameer"}],"340":[{"name":"Al Juffair Pharmacy","group":"Al Juffair Pharmacy","type":"Pharmacy","area":"Manama/AlJuffair"},{"name":"Morgan Pharmacy","group":"Morgan Pharmacy","type":"Pharmacy","area":"Manama/Al Juffair"},{"name":"Morgan Pharmacy","group":"Morgan Pharmacy","type":"Pharmacy","area":"Manama / AlJuffair"}],"752":[{"name":"Life Guard Pharmacy","group":"Life Guard Pharmacy","type":"Pharmacy","area":"Buri"}],"533":[{"name":"Al Kawthar Medical Center Pharmacy","group":"Al Kawthar Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Budaiya"}],"310":[{"name":"Salmaniya Gate Pharmacy","group":"Salmaniya Gate Pharmacy","type":"Pharmacy","area":"Manama/AlSalmaniya"}],"1016":[{"name":"Wasfati Pharmacy","group":"Wasfati Pharmacy","type":"Pharmacy","area":"Al Lawzi"}],"537":[{"name":"Jaffar Pharmacy Branch BaniJamrah","group":"RUYAN PHARMACY","type":"Pharmacy","area":"Bani Jamrah"}],"335":[{"name":"KimsHealth Hospital Pharmacy","group":"KIMS HOSPITAL","type":"Hospital Pharmacy","area":"Manama / Um AlHassam"}],"342":[{"name":"Kottakkal Ayurvedic Centre Pharmacy","group":"Kottakkal Ayurvedic Centre Pharmacy","type":"Hospital Pharmacy","area":"Manama / AlGhurayfah"}],"311":[{"name":"Kairali Ayurvedic Centre Pharmacy","group":"Kairali Ayurvedic Centre Pharmacy","type":"Hospital Pharmacy","area":"Manama/AlSalmaniya"}],"740":[{"name":"Aali Life Care Pharmacy","group":"LIFE CARE PHARMACY","type":"Pharmacy","area":"A'Ali"}],"351":[{"name":"Hajiyat Life Care Pharmacy","group":"Hajiyat Life Care Pharmacy","type":"Pharmacy","area":"Manama/AlSuwayfiyah"},{"name":"Manama Medical Center Pharmacy","group":"Manama Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Manama / AlSuwayfiyah"}],"1002":[{"name":"Amana Bahrain Pharmacy","group":"Amana Bahrain Pharmacy","type":"Hospital Pharmacy","area":"Al Jasrah"}],"912":[{"name":"Makkah Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Riffa / AlGharbi"},{"name":"Clock Roundabout Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Riffa / AlGharbi"},{"name":"Bahrain Specialist Hospital Clinics Pharmacy","group":"Bahrain Specialist Hospital Clinics Pharmacy","type":"Hospital Pharmacy","area":"Riffa / AlGharbi"}],"111":[{"name":"Hidd Marina Pharmacy","group":"MARINA PHARMACY","type":"Pharmacy","area":"Hidd"},{"name":"Oxygen Pharmacy New Hidd","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Hidd"},{"name":"Super Pharma Pharmacy","group":"Super Pharma Pharmacy","type":"Pharmacy","area":"Hidd"}],"368":[{"name":"Gulf American Hospital Pharmacy","group":"Gulf American Hospital Pharmacy","type":"Hospital Pharmacy","area":"South Sehla"}],"331":[{"name":"Maskati Pharmacy","group":"Maskati Pharmacy","type":"Pharmacy","area":"Manama/BuGhazal"}],"128":[{"name":"ASRY Pharmacy","group":"ASRY Pharmacy","type":"Hospital Pharmacy","area":"Hidd"}],"935":[{"name":"Medicare Pharmacy","group":"Medicare Pharmacy","type":"Pharmacy","area":"Riffa / Alhajiyat"}],"326":[{"name":"BU AMMAR PHARMACY","group":"BU AMMAR PHARMACY","type":"Pharmacy","area":"MANAMA-ALQUDAYBIYA"}],"407":[{"name":"ROSE PHARMACIES MAIN BRANCH","group":"ROSE PHARMACY","type":"Pharmacy","area":"Tashan"}],"225":[{"name":"Oxygen Pharmacy","group":"OXYGEN PHARMACY","type":"Pharmacy","area":"Busaiteen"}],"633":[{"name":"I Care Pharmacy","group":"I Care Pharmacy","type":"Pharmacy","area":"Al Maameer"}],"529":[{"name":"American Mission Hospital Medical Center Pharmacy","group":"AMERICAN MISSION HOSPITAL","type":"Hospital Pharmacy","area":"Al Markh"}],"942":[{"name":"Al Malaki Specialist Hospital Pharmacy","group":"Al Malaki Specialist Hospital Pharmacy","type":"Hospital Pharmacy","area":"Riffa/Swayfra"}],"754":[{"name":"Al Amal Hospital Pharmacy","group":"Al Amal Hospital Pharmacy","type":"Hospital Pharmacy","area":"Buri"}],"439":[{"name":"Rana Pharmacy","group":"Rana Pharmacy","type":"Pharmacy","area":"North Sehla"}],"902":[{"name":"Al Suwaifiyah Pharmacy","group":"YMH","type":"Pharmacy","area":"Riffa/AlGharbi"}],"210":[{"name":"Al Shahad Pharmacy","group":"Al Shahad Pharmacy","type":"Pharmacy","area":"Muharraq"}],"305":[{"name":"Shifa Al Jazeera Hospital Pharmacy","group":"Shifa Al Jazeera Hospital Pharmacy","type":"Hospital Pharmacy","area":"Manama Center"}],"709":[{"name":"Milestones Pharmacy","group":"Milestones Pharmacy","type":"Pharmacy","area":"Tubli"}],"644":[{"name":"The Doctor Pharmacy","group":"The Doctor Pharmacy","type":"Pharmacy","area":"Al Nuwaidrat"}],"504":[{"name":"Well Care Pharmacy","group":"WELLCARE PHARMACY","type":"Pharmacy","area":"Jannusan"}],"707":[{"name":"White Pharmacy","group":"White Pharmacy","type":"Pharmacy","area":"Tubli"}],"502":[{"name":"Farmacia by Yara Pharmacy","group":"Farmacia by Yara Pharmacy","type":"Pharmacy","area":"Jannusan"}],"951":[{"name":"Aluminium Bahrain Medical Center Pharmacy","group":"Aluminium Bahrain Medical Center Pharmacy","type":"Hospital Pharmacy","area":"Askar"}]};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOVS = ["Capital","Muharraq","North","South"];
const GOV_META = {
  Capital:  { color:"#3b82f6", ar:"محافظة العاصمة"   },
  Muharraq: { color:"#f59e0b", ar:"محافظة المحرق"      },
  North:    { color:"#10b981", ar:"المحافظة الشمالية"  },
  South:    { color:"#8b5cf6", ar:"المحافظة الجنوبية"  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size=16, className="" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d}/>
  </svg>
);
const pctColor = p => p===100?"#059669":p>=70?"#10b981":p>=50?"#f59e0b":p>=25?"#ef4444":"#dc2626";
const pctBg    = p => p===100?"#ecfdf5":p>=70?"#d1fae5":p>=50?"#fffbeb":p>=25?"#fef2f2":"#fff1f2";

const ProgressBar = ({ pct, color }) => (
  <div style={{background:"#f3f4f6",borderRadius:9999,height:6,overflow:"hidden"}}>
    <div style={{width:`${pct}%`,background:color,height:"100%",borderRadius:9999,transition:"width .5s ease"}}/>
  </div>
);

// ─── BLOCK POPUP ─────────────────────────────────────────────────────────────
// Fixed position popup — positioned via getBoundingClientRect, no portal needed
function BlockPopup({ block, gov, triggerRef, onClose }) {
  const { pharmacyMap, areaNames } = useContext(DataContext);
  const pharmacies = pharmacyMap[String(block)] || [];
  const areaName   = areaNames[String(block)]   || "";
  const boxRef     = useRef(null);
  const m          = GOV_META[gov] || { color:"#6366f1" };

  // Compute position from trigger button
  const [pos, setPos] = useState({ top:0, left:0, width:320, ready:false });
  useEffect(() => {
    if (!triggerRef?.current) return;
    const r   = triggerRef.current.getBoundingClientRect();
    const W   = window.innerWidth;
    const H   = window.innerHeight;
    const PW  = Math.min(320, W - 16);
    const PH  = 420; // estimated popup height
    let left  = r.left;
    let top   = r.bottom + 8;
    if (left + PW > W - 8)  left = Math.max(8, W - PW - 8);
    if (top  + PH > H - 8)  top  = Math.max(8, r.top - PH - 8);
    setPos({ top, left, width: PW, ready:true });
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    const onMouse = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target) &&
          !(triggerRef?.current?.contains(e.target)))
        onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onMouse), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const grouped = useMemo(() => {
    const g = {};
    pharmacies.forEach(p => {
      const k = p.group || p.name;
      if (!g[k]) g[k] = [];
      g[k].push(p);
    });
    return Object.entries(g).sort((a,b) => b[1].length - a[1].length);
  }, [pharmacies]);

  const hospitalCount = pharmacies.filter(p => p.type === "Hospital Pharmacy").length;
  const retailCount   = pharmacies.length - hospitalCount;

  if (!pos.ready) return null;

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        top:      pos.top,
        left:     pos.left,
        width:    pos.width,
        zIndex:   99999,
      }}
      className="glass-card rounded-2xl overflow-hidden pointer-events-auto"
    >
      {/* ── Header ── */}
      <div style={{ background:`linear-gradient(135deg,${m.color}ee,${m.color}99)` }} className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base">Block {block}</span>
              {areaName && (
                <span className="text-xs font-semibold text-white bg-white/25 px-2 py-0.5 rounded-full">
                  {areaName}
                </span>
              )}
              <span className="text-xs text-white/65">{gov}</span>
            </div>
            <div className="flex items-center gap-5 mt-2.5">
              {[
                { val:pharmacies.length, lbl:"pharmacies" },
                { val:grouped.length,    lbl:"groups"     },
                { val:hospitalCount,     lbl:"hospital"   },
              ].map(({ val, lbl }, i) => (
                <div key={lbl} className="flex items-center gap-4">
                  {i > 0 && <div style={{width:1,height:26,background:"rgba(255,255,255,.3)"}}/>}
                  <div className="text-center">
                    <div className="text-xl font-bold text-white leading-none">{val}</div>
                    <div style={{fontSize:10}} className="text-white/60 mt-0.5">{lbl}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors flex-shrink-0 mt-0.5">
            <Icon d="M18 6L6 18M6 6l12 12" size={14}/>
          </button>
        </div>
      </div>

      {/* ── Group list ── */}
      <div style={{ maxHeight:270, overflowY:"auto" }}>
        {grouped.length === 0
          ? <div className="px-4 py-8 text-sm text-gray-400 text-center">No pharmacy data found</div>
          : grouped.map(([groupName, pharms]) => (
            <div key={groupName}
              className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{background:m.color,width:6,height:6,borderRadius:99,flexShrink:0,marginTop:2,display:"inline-block"}}/>
                    <span className="text-sm font-semibold text-gray-800 leading-snug">{groupName}</span>
                  </div>
                  {pharms.map((p, j) => (
                    <div key={j} className="ml-3.5 mt-1 flex items-center gap-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        p.type==="Hospital Pharmacy"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {p.type==="Hospital Pharmacy"?"🏥":"💊"}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
                {pharms.length > 1 && (
                  <span style={{ color:m.color, background:`${m.color}18` }}
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                    ×{pharms.length}
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">{retailCount} retail · {hospitalCount} hospital</span>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">close ✕</button>
      </div>
    </div>
  );
}

// ─── BLOCK CHIP ──────────────────────────────────────────────────────────────
// Each covered block as a clickable chip that opens BlockPopup
function BlockChip({ block, gov, isCovered, isHighlighted }) {
  const { pharmacyMap, areaNames } = useContext(DataContext);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const m = GOV_META[gov] || { color:"#10b981" };
  const pharmCount = isCovered
    ? (pharmacyMap[String(block)]?.length || 0)
    : 0;
  const areaName = areaNames[String(block)] || "";

  const toggle = useCallback((e) => {
    e.stopPropagation();
    if (isCovered) setOpen(o => !o);
  }, [isCovered]);

  if (isHighlighted) {
    // yellow highlight for search
    return (
      <div className="relative inline-block">
        <button ref={btnRef} onClick={toggle}
          style={{ background:"#fef08a", border:"2px solid #ca8a04", color:"#713f12" }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all">
          {block}
          {pharmCount > 0 && (
            <span style={{background:"#ca8a04",color:"white"}} className="ml-1 text-xs px-1 rounded-full font-bold">
              {pharmCount}
            </span>
          )}
        </button>
        {open && <BlockPopup block={block} gov={gov} triggerRef={btnRef} onClose={() => setOpen(false)}/>}
      </div>
    );
  }

  if (isCovered) {
    return (
      <div className="relative inline-block">
        <button ref={btnRef} onClick={toggle}
          style={open ? { background:m.color, borderColor:m.color, color:"white" } : {}}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all hover:scale-105 cursor-pointer ${
            open ? "" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
          }`}>
          <span className="flex flex-col items-center leading-none">
            <span>{block}</span>
            {areaName && (
              <span
                title={areaName}
                style={{ fontSize:"9px", opacity: open ? 0.85 : 0.65, marginTop:1, maxWidth:80, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {areaName}
              </span>
            )}
          </span>
          {pharmCount > 0 && (
            <span style={open
              ? { background:"rgba(255,255,255,.3)", color:"white" }
              : { background:m.color, color:"white" }}
              className="ml-1 text-xs px-1 rounded-full font-bold">
              {pharmCount}
            </span>
          )}
        </button>
        {open && <BlockPopup block={block} gov={gov} triggerRef={btnRef} onClose={() => setOpen(false)}/>}
      </div>
    );
  }

  // Gap block – not clickable, just show number + area name
  return (
    <div className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-red-50 border-red-200 text-red-700 flex flex-col items-center leading-none">
      <span>{block}</span>
      {areaName && (
        <span
          title={areaName}
          style={{ fontSize:"9px", opacity:0.65, marginTop:1, maxWidth:80, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {areaName}
        </span>
      )}
    </div>
  );
}

// ─── ZONE CARD ────────────────────────────────────────────────────────────────
const ZoneCard = ({ gov, zone, data, isExpanded, onToggle, searchBlock }) => {
  const m = GOV_META[gov];
  const pct   = data.coverage_pct;
  const color = pctColor(pct);
  const bg    = pctBg(pct);

  return (
    <div className="glass-card rounded-xl overflow-visible hover-lift">
      <button onClick={onToggle}
        className="w-full flex items-start sm:items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 text-left hover:bg-gray-50 transition-colors rounded-xl">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div style={{ background:`${m.color}20`, color:m.color }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
            {zone.replace("Zone ","")}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-800">{zone}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {data.covered.length} covered · {data.gaps.length} gaps · {data.total} total
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="w-24 hidden sm:block">
            <ProgressBar pct={pct} color={color}/>
          </div>
          <span style={{ color, background:bg }}
            className="text-xs font-bold px-2.5 py-1 rounded-full w-14 text-center">
            {pct===100?"✓ 100%":`${pct}%`}
          </span>
          <Icon d={isExpanded?"M19 9l-7 7-7-7":"M9 5l7 7-7 7"} size={14} className="text-gray-400"/>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-50 px-3 sm:px-5 py-4 space-y-4">
          {/* GAP blocks */}
          {data.gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-red-400"/>
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                  {data.gaps.length} Blocks WITHOUT Pharmacy
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.gaps.map(b => (
                  <BlockChip key={b} block={b} gov={gov} isCovered={false}
                    isHighlighted={searchBlock && String(b).includes(searchBlock)}/>
                ))}
              </div>
            </div>
          )}

          {/* COVERED blocks */}
          {data.covered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                  {data.covered.length} Blocks WITH Pharmacy — click to view details
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.covered.map(b => (
                  <BlockChip key={b} block={b} gov={gov} isCovered={true}
                    isHighlighted={searchBlock && String(b).includes(searchBlock)}/>
                ))}
              </div>
            </div>
          )}

          {data.gaps.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18}/>
              Full coverage — every block in this zone has a pharmacy!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SUMMARY STATS ────────────────────────────────────────────────────────────
const SummaryStats = ({ view }) => {
  const { coverageData } = useContext(DataContext);
  const stats = useMemo(() => {
    let tB=0, cB=0, gB=0;
    const src = view==="all" ? coverageData : { [view]: coverageData[view] };
    Object.values(src).forEach(zones =>
      Object.values(zones).forEach(z => { tB+=z.total; cB+=z.covered.length; gB+=z.gaps.length; })
    );
    return { tB, cB, gB, pct: tB ? Math.round(cB/tB*100) : 0 };
  }, [view]);

  const cards = [
    { label:"Total Blocks",   value:stats.tB,      color:"#6366f1", icon:"M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
    { label:"Blocks Covered", value:stats.cB,      color:"#059669", icon:"M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
    { label:"Uncovered Gaps", value:stats.gB,      color:"#dc2626", icon:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    { label:"Coverage Rate",  value:`${stats.pct}%`, color:pctColor(stats.pct), icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="glass-card rounded-xl p-4 hover-lift">
          <div className="flex items-start justify-between">
            <div>
              <p className="section-title mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
            <div style={{ background:`${c.color}15`, color:c.color }}
              className="w-10 h-10 rounded-xl flex items-center justify-center">
              <Icon d={c.icon} size={17}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── GOV FILTER BAR ───────────────────────────────────────────────────────────
const GovBar = ({ activeGov, setActiveGov }) => {
  const { coverageData } = useContext(DataContext);
  const govSummary = useMemo(() => GOVS.map(gov => {
    let total=0, covered=0;
    Object.values(coverageData[gov]).forEach(z => { total+=z.total; covered+=z.covered.length; });
    return { gov, gaps:total-covered, pct:Math.round(covered/total*100) };
  }), []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <button onClick={() => setActiveGov("all")}
        className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
          activeGov==="all"
            ? "border-gray-800 bg-gray-900 text-white shadow-md"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
        }`}>All Governorates</button>
      {govSummary.map(({ gov, gaps, pct }) => {
        const m = GOV_META[gov];
        const active = activeGov===gov;
        return (
          <button key={gov} onClick={() => setActiveGov(gov)}
            style={active ? { borderColor:m.color, background:m.color } : {}}
            className={`w-full py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
              active ? "text-white shadow-md" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}>
            <div className="text-center">
              <div>{gov}</div>
              <div style={{ color: active ? "rgba(255,255,255,.8)" : pctColor(pct) }}
                className="text-xs font-normal mt-0.5">
                {gaps} gaps · {pct}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── GAPS ONLY TABLE ──────────────────────────────────────────────────────────
const GapsOnlyView = ({ govFilter }) => {
  const { coverageData, areaNames } = useContext(DataContext);
  const rows = useMemo(() => {
    const out = [];
    const govs = govFilter==="all" ? GOVS : [govFilter];
    govs.forEach(gov => {
      Object.entries(coverageData[gov]).forEach(([zone, data]) => {
        if (data.gaps.length > 0)
          out.push({ gov, zone, gaps:data.gaps, total:data.total, pct:data.coverage_pct });
      });
    });
    return out.sort((a,b) => a.pct - b.pct);
  }, [govFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"/>
          <h3 className="font-semibold text-gray-800">
            Uncovered Blocks — {rows.flatMap(r=>r.gaps).length} gaps across {rows.length} zones
          </h3>
        </div>
        <span className="text-xs text-gray-400">Sorted by worst coverage first</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Governorate","Zone","Coverage","Gaps","Block Numbers"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(({ gov, zone, gaps, total, pct }) => {
              const m = GOV_META[gov];
              return (
                <tr key={`${gov}-${zone}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className="badge font-semibold" style={{ color: m.color, backgroundColor: `${m.color}15` }}>{gov}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium text-xs">{zone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16"><ProgressBar pct={pct} color={pctColor(pct)}/></div>
                      <span style={{ color:pctColor(pct) }} className="text-xs font-bold">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-2 py-0.5 rounded-full">
                      {gaps.length}/{total}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {gaps.map(b => {
                        const area = areaNames[String(b)] || "";
                        return (
                          <div key={b} className="flex flex-col items-center bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-2 py-0.5 rounded leading-none">
                            <span>{b}</span>
                            {area && <span style={{fontSize:"8px",opacity:.6}}>{area}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};


// ─── POPULATION INTELLIGENCE VIEW ────────────────────────────────────────────
function PopulationView() {
  const { coverageData, areaNames } = useContext(DataContext);
  const [activeTab, setActiveTab] = useState("overview"); // overview | opportunities | density

  // Per-gov stats
  const govStats = useMemo(() => {
    return GOVS.map(gov => {
      const zones = coverageData[gov];
      let total=0, covered=0, gaps=0;
      Object.values(zones).forEach(z => {
        total   += z.total;
        covered += z.covered.length;
        gaps    += z.gaps.length;
      });
      const pop        = POP_DATA[gov].total;
      const popPerBlock = pop / total;
      const estGapPop  = popPerBlock * gaps;
      const coveragePct = Math.round(covered/total*100);
      const pharmacyPer100k = (covered / pop) * 100000;
      return { gov, total, covered, gaps, pop, popPerBlock, estGapPop, coveragePct, pharmacyPer100k };
    });
  }, []);

  // Opportunity index: gap blocks weighted by pop density
  // Higher score = more urgent need
  const opportunityData = useMemo(() => {
    const rows = [];
    GOVS.forEach(gov => {
      const pop = POP_DATA[gov].total;
      const allBlocks = Object.values(coverageData[gov]).reduce((a,z) => a+z.total, 0);
      const popPerBlock = pop / allBlocks;
      
      // Group gap blocks by area
      const areaGaps = {};
      Object.entries(coverageData[gov]).forEach(([zone, data]) => {
        data.gaps.forEach(block => {
          const area = areaNames[String(block)] || "Unknown area";
          if (!areaGaps[area]) areaGaps[area] = { blocks:[], zone, gov };
          areaGaps[area].blocks.push(block);
        });
      });

      Object.entries(areaGaps).forEach(([area, info]) => {
        if (info.blocks.length === 0) return;
        const estPop     = popPerBlock * info.blocks.length;
        const urgency    = estPop;  // simple: more pop → more urgent
        rows.push({
          gov, area,
          gapCount: info.blocks.length,
          popPerBlock: Math.round(popPerBlock),
          estPop: Math.round(estPop),
          urgency,
          blocks: info.blocks.sort((a,b)=>a-b),
        });
      });
    });
    return rows.sort((a,b) => b.urgency - a.urgency);
  }, []);

  const m = GOV_META;
  const totalPop = TOTAL_POP;

  // ── Overview tab ──
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Population vs Coverage summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {govStats.map(gs => {
          const gm = m[gs.gov];
          const popShare = Math.round(gs.pop/totalPop*100);
          return (
            <div key={gs.gov} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div style={{color:gm.color}} className="text-xs font-bold uppercase tracking-wide mb-1">{gs.gov}</div>
                  <div className="text-2xl font-bold text-gray-900">{gs.pop.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-0.5">population · {popShare}% of Bahrain</div>
                </div>
                <div style={{background:`${gm.color}15`,color:gm.color}}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold">
                  {popShare}%
                </div>
              </div>

              {/* Pop bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Share of total population</span>
                  <span>{gs.pop.toLocaleString()}</span>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:8}}>
                  <div style={{width:`${popShare}%`,background:gm.color,height:8,borderRadius:99,transition:"width .5s"}}/>
                </div>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div style={{color:gm.color}} className="text-lg font-bold">{gs.coveragePct}%</div>
                  <div className="text-xs text-gray-400 mt-0.5">Block coverage</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-red-600">{gs.gaps}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Gap blocks</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-amber-600">{gs.pharmacyPer100k.toFixed(1)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Pharmacies/100k</div>
                </div>
              </div>

              {/* Population in gaps */}
              <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="text-xs text-red-700 font-medium">Est. population in gap blocks</div>
                <div className="text-sm font-bold text-red-700">{Math.round(gs.estGapPop).toLocaleString()}</div>
              </div>

              {/* Bahraini vs Non-Bahraini */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-blue-700">{Math.round(POP_DATA[gs.gov].bahraini/gs.pop*100)}%</div>
                  <div className="text-xs text-blue-400">Bahraini</div>
                </div>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-purple-700">{Math.round(POP_DATA[gs.gov].non_bahraini/gs.pop*100)}%</div>
                  <div className="text-xs text-purple-400">Non-Bahraini</div>
                </div>
                <div className="bg-pink-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-pink-700">{Math.round(POP_DATA[gs.gov].females/gs.pop*100)}%</div>
                  <div className="text-xs text-pink-400">Female</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pharmacy per capita comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💊</span> Pharmacies per 100,000 Population
        </h3>
        <div className="space-y-3">
          {[...govStats].sort((a,b) => b.pharmacyPer100k - a.pharmacyPer100k).map(gs => {
            const gm = m[gs.gov];
            const maxVal = Math.max(...govStats.map(g=>g.pharmacyPer100k));
            const barPct = gs.pharmacyPer100k/maxVal*100;
            return (
              <div key={gs.gov} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-full sm:w-24 text-sm font-semibold text-gray-700">{gs.gov}</div>
                <div className="flex-1">
                  <div style={{background:"#f3f4f6",borderRadius:99,height:28,overflow:"hidden",position:"relative"}}>
                    <div style={{width:`${barPct}%`,background:`${gm.color}30`,height:"100%",transition:"width .5s"}}/>
                    <div style={{position:"absolute",left:12,top:0,height:"100%",display:"flex",alignItems:"center"}}>
                      <span style={{color:gm.color}} className="text-sm font-bold">{gs.pharmacyPer100k.toFixed(1)}</span>
                      <span className="hidden md:inline text-xs text-gray-500 ml-1.5">per 100k · {gs.covered} pharmacies for {gs.pop.toLocaleString()} people</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * Based on registered pharmacy blocks. WHO recommendation: ~20 pharmacies per 100,000 population.
        </p>
      </div>
    </div>
  );

  // ── Opportunities tab ──
  const OpportunitiesTab = () => {
    const [filterGov, setFilterGov] = useState("all");
    const filtered = filterGov==="all" ? opportunityData : opportunityData.filter(r=>r.gov===filterGov);
    const top = filtered.slice(0, 20);

    return (
      <div>
        {/* Top priority banner */}
        {opportunityData.length > 0 && (
          <div className="mb-5 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl p-5 text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="text-xs font-semibold opacity-80 uppercase tracking-wide mb-1">🏆 #1 Highest Priority Opportunity</div>
                <div className="text-2xl font-bold">{opportunityData[0].area}</div>
                <div className="text-sm opacity-80 mt-1">{opportunityData[0].gov} · {opportunityData[0].gapCount} uncovered blocks</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl font-bold">{opportunityData[0].estPop.toLocaleString()}</div>
                <div className="text-xs opacity-80">estimated residents without pharmacy</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {opportunityData[0].blocks.map(b => (
                <span key={b} className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">Block {b}</span>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all",...GOVS].map(g => {
            const active = filterGov===g;
            const gm = g==="all" ? null : m[g];
            return (
              <button key={g} onClick={() => setFilterGov(g)}
                style={active && gm ? {background:gm.color,borderColor:gm.color,color:"white"} :
                       active ? {background:"#111827",borderColor:"#111827",color:"white"} : {}}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  active ? "" : "border-gray-200 bg-white text-gray-600"
                }`}>
                {g==="all"?"All":g}
              </button>
            );
          })}
        </div>

        {/* Opportunity table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-50 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Area Opportunity Ranking — sorted by estimated population impact
            </span>
            <span className="text-xs text-gray-400">{filtered.length} areas</span>
          </div>
          <div className="divide-y divide-gray-50">
            {top.map((row, idx) => {
              const gm = m[row.gov];
              const maxEst = opportunityData[0]?.estPop || 1;
              const barPct = row.estPop/maxEst*100;
              const rankColor = idx===0?"#dc2626":idx<3?"#ea580c":idx<7?"#f59e0b":"#6b7280";
              return (
                <div key={`${row.gov}-${row.area}`}
                  className="px-3 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Rank badge */}
                      <div style={{background:`${rankColor}15`,color:rankColor,minWidth:28}}
                        className="text-sm font-black text-center py-1 rounded-lg flex-shrink-0">
                        #{idx+1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">{row.area}</span>
                          <span style={{color:gm.color,background:`${gm.color}15`}}
                            className="text-xs px-2 py-0.5 rounded-full font-semibold">{row.gov}</span>
                        </div>
                        {/* Block chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {row.blocks.map(b => (
                            <span key={b} className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">
                              {b}
                            </span>
                          ))}
                        </div>
                        {/* Bar */}
                        <div className="mt-2" style={{background:"#f3f4f6",borderRadius:99,height:4}}>
                          <div style={{width:`${barPct}%`,background:rankColor,height:4,borderRadius:99,transition:"width .6s"}}/>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <div className="text-base font-bold text-gray-800">{row.estPop.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">est. residents</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {row.gapCount} blocks · ~{row.popPerBlock.toLocaleString()}/block
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const DensityTab = () => {
    const densityRows = govStats.map(gs => ({
      ...gs,
      score: Math.round((gs.pop/gs.total) * (100-gs.coveragePct) / 100 * 10) / 10,
    })).sort((a,b)=>b.score-a.score);

    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800 font-medium">
            <strong>Opportunity Score</strong> = (Population ÷ Blocks) × (1 − Coverage%) 
            — higher means more people per block AND lower current coverage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {densityRows.map((gs, idx) => {
            const gm = m[gs.gov];
            const maxScore = densityRows[0].score;
            const barPct   = gs.score/maxScore*100;
            return (
              <div key={gs.gov}
                className={`bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 ${idx===0?"border-red-300":"border-gray-100"}`}>
                {idx===0 && (
                  <div className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2">
                    🎯 HIGHEST PRIORITY
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{color:gm.color}} className="font-bold text-base">{gs.gov}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{gs.pop.toLocaleString()} people</div>
                  </div>
                  <div style={{background:`${gm.color}15`,color:gm.color}}
                    className="text-2xl font-black px-3 py-1 rounded-xl">
                    {gs.score}
                  </div>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:10,overflow:"hidden"}}>
                  <div style={{width:`${barPct}%`,background:gm.color,height:10,borderRadius:99,transition:"width .6s"}}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <div className="text-sm font-bold text-gray-700">{Math.round(gs.popPerBlock).toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Pop/block</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-600">{100-gs.coveragePct}%</div>
                    <div className="text-xs text-gray-400">Gap rate</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-700">{gs.gaps}</div>
                    <div className="text-xs text-gray-400">Open blocks</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-3">📊 How to read the scores</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• <strong>Capital</strong> has the highest population density per block (~4,498 people/block) but moderate gap rate (42%), making it high priority for urban infill.</p>
            <p>• <strong>Muharraq</strong> has a significant gap in Hidd (12 uncovered blocks) — a fast-growing area with high non-Bahraini population (51%).</p>
            <p>• <strong>North</strong> has the most raw gap blocks (96) but lower density — Hamad Town and Northern City are the biggest opportunities.</p>
            <p>• <strong>South</strong> has large underserved areas (Zone 10: 0% coverage) with growing new residential districts.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5 bg-white rounded-xl border border-gray-100 p-1.5 shadow-sm w-full">
        {[
          { id:"overview",       label:"📊 Population Overview" },
          { id:"opportunities",  label:"🎯 Opportunity Ranking" },
          { id:"density",        label:"🔥 Priority Score"     },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab===tab.id
                ? "bg-gray-900 text-white shadow"
                : "text-gray-600 hover:bg-gray-50"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab==="overview"      && <OverviewTab/>}
      {activeTab==="opportunities" && <OpportunitiesTab/>}
      {activeTab==="density"       && <DensityTab/>}
    </div>
  );
}

// ─── BLOCK SEARCH ─────────────────────────────────────────────────────────────
const BlockSearch = ({ onResult }) => {
  const { coverageData } = useContext(DataContext);
  const [val, setVal] = useState("");
  const search = () => {
    const num = parseInt(val.trim());
    if (!num) { onResult(null); return; }
    for (const gov of GOVS) {
      for (const [zone, data] of Object.entries(coverageData[gov])) {
        if (data.covered.includes(num)) { onResult({ block:num, gov, zone, status:"covered" }); return; }
        if (data.gaps.includes(num))    { onResult({ block:num, gov, zone, status:"gap"     }); return; }
      }
    }
    onResult({ block:num, gov:null, zone:null, status:"not_found" });
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
        Quick Block Lookup
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
          placeholder="Enter block number (e.g. 502)..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <button onClick={search}
          className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          Search
        </button>
        {val && (
          <button onClick={()=>{setVal("");onResult(null);}}
            className="w-full sm:w-auto px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">✕</button>
        )}
      </div>
    </div>
  );
};

const AddPharmacyModal = ({ isOpen, onClose, onSave, coverageData }) => {
  const [gov, setGov] = useState(GOVS[0]);
  const [zone, setZone] = useState("Zone 01");
  const [block, setBlock] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [type, setType] = useState("Pharmacy");

  if (!isOpen) return null;

  const availableZones = coverageData[gov] ? Object.keys(coverageData[gov]) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!block || !name) return;
    onSave({ gov, zone, block, area, name, group: group || name, type });
    onClose();
    setBlock(""); setArea(""); setName(""); setGroup(""); setType("Pharmacy");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Link Pharmacy to Block</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Governorate</label>
              <select className="w-full border rounded-lg p-2 bg-white" value={gov} onChange={e => {setGov(e.target.value); setZone(Object.keys(coverageData[e.target.value])[0]);}}>
                {GOVS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zone</label>
              <select className="w-full border rounded-lg p-2 bg-white" value={zone} onChange={e => setZone(e.target.value)}>
                {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Block Number *</label>
              <input required type="number" className="w-full border rounded-lg p-2" value={block} onChange={e => setBlock(e.target.value)} placeholder="e.g. 502" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Area Name</label>
              <input type="text" className="w-full border rounded-lg p-2" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Jannusan" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pharmacy Name *</label>
            <input required type="text" className="w-full border rounded-lg p-2" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Al-Dawaa Pharmacy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Group Name</label>
              <input type="text" className="w-full border rounded-lg p-2" value={group} onChange={e => setGroup(e.target.value)} placeholder="Defaults to Name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded-lg p-2 bg-white" value={type} onChange={e => setType(e.target.value)}>
                <option>Pharmacy</option>
                <option>Hospital Pharmacy</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">Save Link</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function BlockCoverageAnalyzer({ onBack }) {
  const [coverageData, setCoverageData] = useState(() => {
    const saved = localStorage.getItem('BCA_COVERAGE_DATA');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(COVERAGE_DATA));
  });
  const [pharmacyMap, setPharmacyMap] = useState(() => {
    const saved = localStorage.getItem('BCA_PHARMACY_MAP');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(BLOCK_PHARMACY_MAP));
  });
  const [areaNames, setAreaNames] = useState(() => {
    const saved = localStorage.getItem('BCA_AREA_NAMES');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(BLOCK_AREA_NAMES));
  });

  const [activeGov,    setActiveGov]    = useState("all");
  const [displayMode,  setDisplayMode]  = useState("zones");
  const [expandedZones,setExpandedZones] = useState({});
  const [searchResult, setSearchResult] = useState(null);
  const [searchHL,     setSearchHL]     = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddPharmacy = (data) => {
    const { gov, zone, block, area, name, group, type } = data;
    const numBlock = parseInt(block);
    
    const newPharmacyMap = { ...pharmacyMap };
    if (!newPharmacyMap[numBlock]) newPharmacyMap[numBlock] = [];
    newPharmacyMap[numBlock].push({ name, group, type, area });
    
    const newAreaNames = { ...areaNames };
    if (area) newAreaNames[numBlock] = area;

    const newCoverageData = JSON.parse(JSON.stringify(coverageData));
    const zData = newCoverageData[gov][zone];
    
    if (zData.gaps.includes(numBlock)) {
      zData.gaps = zData.gaps.filter(b => b !== numBlock);
      if (!zData.covered.includes(numBlock)) zData.covered.push(numBlock);
    } else if (!zData.covered.includes(numBlock)) {
      zData.covered.push(numBlock);
      zData.total += 1;
    }
    zData.coverage_pct = Math.round((zData.covered.length / zData.total) * 100);

    setPharmacyMap(newPharmacyMap);
    setAreaNames(newAreaNames);
    setCoverageData(newCoverageData);

    localStorage.setItem('BCA_PHARMACY_MAP', JSON.stringify(newPharmacyMap));
    localStorage.setItem('BCA_AREA_NAMES', JSON.stringify(newAreaNames));
    localStorage.setItem('BCA_COVERAGE_DATA', JSON.stringify(newCoverageData));
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Block Coverage');
    
    ws.columns = [
      { header: 'Governorate', key: 'gov', width: 15 },
      { header: 'Zone', key: 'zone', width: 12 },
      { header: 'Block', key: 'block', width: 10 },
      { header: 'Area', key: 'area', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Pharmacies Count', key: 'pharmCount', width: 18 },
      { header: 'Pharmacies', key: 'pharmacies', width: 50 },
    ];

    for (const gov of GOVS) {
      for (const [zone, data] of Object.entries(coverageData[gov])) {
        for (const block of data.covered) {
          const pharms = pharmacyMap[String(block)] || [];
          ws.addRow({
            gov, zone, block,
            area: areaNames[String(block)] || '',
            status: 'Covered',
            pharmCount: pharms.length,
            pharmacies: pharms.map(p => p.name).join(', ')
          });
        }
        for (const block of data.gaps) {
          ws.addRow({
            gov, zone, block,
            area: areaNames[String(block)] || '',
            status: 'Gap',
            pharmCount: 0,
            pharmacies: ''
          });
        }
      }
    }

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Block_Coverage_Data.xlsx');
  };

  const toggleZone = (gov, zone) => {
    const k = `${gov}__${zone}`;
    setExpandedZones(p => ({ ...p, [k]: !p[k] }));
  };
  const isExpanded = (gov, zone) => !!expandedZones[`${gov}__${zone}`];

  const expandAll = () => {
    const all = {};
    GOVS.forEach(gov => Object.keys(COVERAGE_DATA[gov]).forEach(zone => { all[`${gov}__${zone}`]=true; }));
    setExpandedZones(all);
  };

  const handleSearch = (result) => {
    setSearchResult(result);
    if (result?.block) {
      setSearchHL(String(result.block));
      if (result.gov) {
        setActiveGov(result.gov);
        setDisplayMode("zones");
        if (result.zone) setExpandedZones(p => ({ ...p, [`${result.gov}__${result.zone}`]:true }));
      }
    } else { setSearchHL(""); }
  };

  const govData = activeGov==="all"
    ? Object.entries(coverageData)
    : [[activeGov, coverageData[activeGov]]];

  return (
    <DataContext.Provider value={{ coverageData, pharmacyMap, areaNames }}>
      <AddPharmacyModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleAddPharmacy} coverageData={coverageData} />
      <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors" title="Back">
                <Icon d="M15 19l-7-7 7-7" size={17} />
              </button>
            )}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow">
              <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" size={17} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Block Coverage Analyzer</h1>
              <p className="text-xs text-gray-400">Bahrain Pharmacy Gap Analysis · 478 registered blocks</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={()=>setIsAddModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
              + Link Pharmacy
            </button>
            <button onClick={exportToExcel}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-800 text-white hover:bg-gray-900 shadow-sm flex items-center gap-2">
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" size={16}/>
              Export Excel
            </button>
            <button onClick={()=>setDisplayMode("zones")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="zones"?"bg-gray-900 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>Zone View</button>
            <button onClick={()=>setDisplayMode("gaps_only")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="gaps_only"?"bg-red-600 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>🔴 Gaps Only</button>
            <button onClick={()=>setDisplayMode("population")}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                displayMode==="population"?"bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>👥 Population Intel</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <BlockSearch onResult={handleSearch}/>

        {/* Search result banner */}
        {searchResult && (
          <div style={{
            background: searchResult.status==="covered"?"#ecfdf5":searchResult.status==="gap"?"#fef2f2":"#fafafa",
            borderColor: searchResult.status==="covered"?"#10b981":searchResult.status==="gap"?"#ef4444":"#d1d5db",
          }} className="rounded-xl border-2 p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-2xl">
              {searchResult.status==="covered"?"✅":searchResult.status==="gap"?"🔴":"❓"}
            </span>
            <div>
              {searchResult.status==="covered" && (
                <p className="font-semibold text-emerald-800">
                  Block <strong>{searchResult.block}</strong>
                  {areaNames?.[String(searchResult.block)] && ` (${areaNames[String(searchResult.block)]})`}
                  {" "}is covered — there is a registered pharmacy in this block.
                  <span className="ml-2 text-emerald-600 font-normal">{searchResult.gov} · {searchResult.zone}</span>
                </p>
              )}
              {searchResult.status==="gap" && (
                <p className="font-semibold text-red-800">
                  Block <strong>{searchResult.block}</strong>
                  {areaNames?.[String(searchResult.block)] && ` (${areaNames[String(searchResult.block)]})`}
                  {" "}has NO registered pharmacy — opportunity gap!
                  <span className="ml-2 text-red-600 font-normal">{searchResult.gov} · {searchResult.zone}</span>
                </p>
              )}
              {searchResult.status==="not_found" && (
                <p className="font-semibold text-gray-700">Block <strong>{searchResult.block}</strong> not found in registered Bahrain blocks.</p>
              )}
            </div>
          </div>
        )}

        {displayMode!=="population" && <SummaryStats view={activeGov}/>}
        {displayMode!=="population" && <GovBar activeGov={activeGov} setActiveGov={setActiveGov}/>}

        {displayMode==="gaps_only" && <GapsOnlyView govFilter={activeGov}/>}

        {displayMode==="population" && <PopulationView/>}

        {displayMode==="zones" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">
                {activeGov==="all"?"All Governorates":activeGov} — Zone Breakdown
              </h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={expandAll}
                  className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors font-medium">
                  Expand All
                </button>
                <button onClick={()=>setExpandedZones({})}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  Collapse All
                </button>
              </div>
            </div>
            <div className="space-y-8">
              {govData.map(([gov, zones]) => (
                <div key={gov}>
                  {activeGov==="all" && (
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{ background:GOV_META[gov].color }} className="w-3 h-3 rounded-full"/>
                      <h4 className="font-bold text-gray-800">{gov} Governorate</h4>
                      <span className="text-xs text-gray-400">{GOV_META[gov].ar}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(zones).map(([zone, data]) => (
                      <ZoneCard key={zone} gov={gov} zone={zone} data={data}
                        isExpanded={isExpanded(gov,zone)} onToggle={()=>toggleZone(gov,zone)}
                        searchBlock={searchHL}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Legend */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coverage Legend</h4>
          <div className="flex gap-6 flex-wrap">
            {[
              { range:"100%",   color:"#059669", label:"Full coverage"     },
              { range:"70–99%", color:"#10b981", label:"Good coverage"     },
              { range:"50–69%", color:"#f59e0b", label:"Moderate coverage" },
              { range:"25–49%", color:"#ef4444", label:"Low coverage"      },
              { range:"0–24%",  color:"#dc2626", label:"Critical gap"      },
            ].map(({ range, color, label }) => (
              <div key={range} className="flex items-center gap-2">
                <span style={{ background:color }} className="w-3 h-3 rounded-full"/>
                <span className="text-xs font-bold" style={{ color }}>{range}</span>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-gray-200 pt-2 sm:pt-0 sm:ml-4 sm:pl-4">
              <span className="text-xs text-gray-500">🟢 Click any green block to see pharmacy details</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </DataContext.Provider>
  );
}
