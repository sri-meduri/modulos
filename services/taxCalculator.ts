// ─── 2026 Federal Data (IRS Rev. Proc. 2025-32 / OBBBA) ──────────────────────

const FEDERAL_BRACKETS = {
    single: [
        [0.10,      0,       12_400],
        [0.12,  12_400,      50_400],
        [0.22,  50_400,     105_700],
        [0.24, 105_700,     201_775],
        [0.32, 201_775,     256_225],
        [0.35, 256_225,     640_600],
        [0.37, 640_600, Infinity],
    ],
    married: [
        [0.10,      0,       24_800],
        [0.12,  24_800,     100_800],
        [0.22, 100_800,     211_400],
        [0.24, 211_400,     403_550],
        [0.32, 403_550,     512_450],
        [0.35, 512_450,     768_700],
        [0.37, 768_700, Infinity],
    ],
};

const FED_STD_DED = { single: 16_100, married: 32_200 };
const SS_WAGE_BASE = 176_100;
const LIMIT_401K   = 23_500;
const LIMIT_IRA    = 7_000;

// ─── State Tax Data ───────────────────────────────────────────────────────────

type Bracket = [number, number, number];
interface SD {
    name: string;
    bS: Bracket[];
    bM: Bracket[] | '2x' | null;
    sdS: number; sdM: number;
    ex: number;  exC: number;
}

const INF = Infinity;
const F = 16_100;
const FM = 32_200;

const STATES: Record<string, SD> = {
    AK: { name:'Alaska',         bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    FL: { name:'Florida',        bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    NV: { name:'Nevada',         bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    NH: { name:'New Hampshire',  bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    SD: { name:'South Dakota',   bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    TN: { name:'Tennessee',      bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    TX: { name:'Texas',          bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    WA: { name:'Washington',     bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },
    WY: { name:'Wyoming',        bS:[[0,0,INF]], bM:'2x', sdS:0,  sdM:0,   ex:0,     exC:0 },

    AZ: { name:'Arizona',        bS:[[0.025,0,INF]], bM:'2x', sdS:14_600, sdM:29_200, ex:0,     exC:0 },
    CO: { name:'Colorado',       bS:[[0.044,0,INF]], bM:'2x', sdS:F,      sdM:FM,     ex:0,     exC:0 },
    GA: { name:'Georgia',        bS:[[0.0549,0,INF]],bM:'2x', sdS:5_400,  sdM:7_100,  ex:3_000, exC:0 },
    ID: { name:'Idaho',          bS:[[0.0570,0,INF]],bM:'2x', sdS:F,      sdM:FM,     ex:0,     exC:0 },
    IL: { name:'Illinois',       bS:[[0.0495,0,INF]],bM:'2x', sdS:0,      sdM:0,      ex:2_425, exC:0 },
    IN: { name:'Indiana',        bS:[[0.030,0,INF]], bM:'2x', sdS:0,      sdM:0,      ex:1_000, exC:0 },
    KY: { name:'Kentucky',       bS:[[0.040,0,INF]], bM:'2x', sdS:3_160,  sdM:3_160,  ex:0,     exC:0 },
    LA: { name:'Louisiana',      bS:[[0.030,0,INF]], bM:'2x', sdS:12_500, sdM:25_000, ex:0,     exC:0 },
    MA: { name:'Massachusetts',  bS:[[0.050,0,INF]], bM:'2x', sdS:0,      sdM:0,      ex:4_400, exC:0 },
    MI: { name:'Michigan',       bS:[[0.0425,0,INF]],bM:'2x', sdS:0,      sdM:0,      ex:5_600, exC:0 },
    MS: { name:'Mississippi',    bS:[[0,0,10_000],[0.044,10_000,INF]], bM:'2x', sdS:2_300, sdM:4_600, ex:6_000, exC:0 },
    NC: { name:'North Carolina', bS:[[0.0450,0,INF]],bM:'2x', sdS:12_750, sdM:25_500, ex:0,     exC:0 },
    ND: { name:'North Dakota',   bS:[[0.025,0,INF]], bM:'2x', sdS:F,      sdM:FM,     ex:0,     exC:0 },
    OH: { name:'Ohio',           bS:[[0.0275,0,INF]],bM:'2x', sdS:0,      sdM:0,      ex:2_500, exC:0 },
    PA: { name:'Pennsylvania',   bS:[[0.0307,0,INF]],bM:'2x', sdS:0,      sdM:0,      ex:0,     exC:0 },
    UT: { name:'Utah',           bS:[[0.0465,0,INF]],bM:'2x', sdS:F,      sdM:FM,     ex:0,     exC:826 },

    AL: {
        name:'Alabama',
        bS:[[0.02,0,500],[0.04,500,3_000],[0.05,3_000,INF]],
        bM:[[0.02,0,1_000],[0.04,1_000,6_000],[0.05,6_000,INF]],
        sdS:2_500, sdM:7_500, ex:1_500, exC:0
    },
    AR: { name:'Arkansas',       bS:[[0.039,0,INF]], bM:'2x', sdS:2_200, sdM:4_400, ex:0, exC:29 },
    CA: {
        name:'California',
        bS:[[0.01,0,10_756],[0.02,10_756,25_499],[0.04,25_499,40_245],[0.06,40_245,55_866],
            [0.08,55_866,70_606],[0.093,70_606,360_659],[0.103,360_659,432_787],
            [0.113,432_787,721_314],[0.123,721_314,INF]],
        bM:[[0.01,0,21_512],[0.02,21_512,50_998],[0.04,50_998,80_490],[0.06,80_490,111_732],
            [0.08,111_732,141_212],[0.093,141_212,721_318],[0.103,721_318,865_574],
            [0.113,865_574,1_442_628],[0.123,1_442_628,INF]],
        sdS:5_202, sdM:10_404, ex:0, exC:144
    },
    CT: {
        name:'Connecticut',
        bS:[[0.02,0,10_000],[0.045,10_000,50_000],[0.055,50_000,100_000],
            [0.06,100_000,200_000],[0.065,200_000,250_000],[0.069,250_000,500_000],[0.0699,500_000,INF]],
        bM:[[0.02,0,20_000],[0.045,20_000,100_000],[0.055,100_000,200_000],
            [0.06,200_000,400_000],[0.065,400_000,500_000],[0.069,500_000,1_000_000],[0.0699,1_000_000,INF]],
        sdS:0, sdM:0, ex:0, exC:0
    },
    DE: {
        name:'Delaware',
        bS:[[0,0,2_000],[0.022,2_000,5_000],[0.039,5_000,10_000],[0.048,10_000,20_000],
            [0.052,20_000,25_000],[0.0555,25_000,60_000],[0.066,60_000,INF]],
        bM:'2x',
        sdS:3_250, sdM:6_500, ex:0, exC:110
    },
    HI: {
        name:'Hawaii',
        bS:[[0.014,0,2_400],[0.032,2_400,4_800],[0.055,4_800,9_600],[0.064,9_600,14_400],
            [0.068,14_400,19_200],[0.072,19_200,24_000],[0.076,24_000,36_000],
            [0.079,36_000,48_000],[0.0825,48_000,150_000],[0.09,150_000,175_000],
            [0.10,175_000,200_000],[0.11,200_000,INF]],
        bM:'2x',
        sdS:2_200, sdM:4_400, ex:1_144, exC:0
    },
    IA: { name:'Iowa',           bS:[[0.038,0,INF]], bM:'2x', sdS:F, sdM:FM, ex:0, exC:40 },
    KS: {
        name:'Kansas',
        bS:[[0.052,0,30_000],[0.0558,30_000,INF]],
        bM:[[0.052,0,60_000],[0.0558,60_000,INF]],
        sdS:3_605, sdM:8_240, ex:9_160, exC:0
    },
    MD: {
        name:'Maryland',
        bS:[[0.02,0,1_000],[0.03,1_000,2_000],[0.04,2_000,3_000],[0.0475,3_000,100_000],
            [0.05,100_000,125_000],[0.0525,125_000,150_000],[0.055,150_000,250_000],[0.0575,250_000,INF]],
        bM:[[0.02,0,1_000],[0.03,1_000,2_000],[0.04,2_000,3_000],[0.0475,3_000,150_000],
            [0.05,150_000,175_000],[0.0525,175_000,225_000],[0.055,225_000,300_000],[0.0575,300_000,INF]],
        sdS:4_000, sdM:8_000, ex:3_200, exC:0
    },
    ME: {
        name:'Maine',
        bS:[[0.058,0,24_500],[0.0675,24_500,58_050],[0.0715,58_050,INF]],
        bM:[[0.058,0,49_050],[0.0675,49_050,116_100],[0.0715,116_100,INF]],
        sdS:F, sdM:FM, ex:4_700, exC:0
    },
    MN: {
        name:'Minnesota',
        bS:[[0.0535,0,31_690],[0.068,31_690,104_090],[0.0785,104_090,193_240],[0.0985,193_240,INF]],
        bM:[[0.0535,0,46_330],[0.068,46_330,184_040],[0.0785,184_040,330_440],[0.0985,330_440,INF]],
        sdS:14_575, sdM:29_150, ex:4_800, exC:0
    },
    MO: {
        name:'Missouri',
        bS:[[0.015,0,1_207],[0.02,1_207,2_414],[0.025,2_414,3_620],[0.03,3_620,4_827],
            [0.035,4_827,6_034],[0.04,6_034,7_240],[0.045,7_240,8_447],[0.048,8_447,INF]],
        bM:'2x',
        sdS:F, sdM:FM, ex:2_100, exC:0
    },
    MT: {
        name:'Montana',
        bS:[[0.047,0,20_500],[0.059,20_500,INF]],
        bM:[[0.047,0,41_000],[0.059,41_000,INF]],
        sdS:F, sdM:FM, ex:2_070, exC:0
    },
    NE: {
        name:'Nebraska',
        bS:[[0.0246,0,3_700],[0.0351,3_700,22_170],[0.0501,22_170,35_730],[0.0584,35_730,INF]],
        bM:[[0.0246,0,7_400],[0.0351,7_400,44_340],[0.0501,44_340,71_450],[0.0584,71_450,INF]],
        sdS:F, sdM:FM, ex:0, exC:157
    },
    NJ: {
        name:'New Jersey',
        bS:[[0.014,0,20_000],[0.0175,20_000,35_000],[0.035,35_000,40_000],
            [0.05525,40_000,75_000],[0.0637,75_000,500_000],[0.0897,500_000,1_000_000],[0.1075,1_000_000,INF]],
        bM:[[0.014,0,20_000],[0.0175,20_000,50_000],[0.0245,50_000,70_000],[0.035,70_000,80_000],
            [0.05525,80_000,150_000],[0.0637,150_000,500_000],[0.0897,500_000,1_000_000],[0.1075,1_000_000,INF]],
        sdS:0, sdM:0, ex:1_000, exC:0
    },
    NM: {
        name:'New Mexico',
        bS:[[0.017,0,5_500],[0.032,5_500,11_000],[0.047,11_000,16_000],[0.059,16_000,INF]],
        bM:[[0.017,0,11_000],[0.032,11_000,22_000],[0.047,22_000,32_000],[0.059,32_000,INF]],
        sdS:F, sdM:FM, ex:4_000, exC:0
    },
    NY: {
        name:'New York',
        bS:[[0.04,0,8_500],[0.045,8_500,11_700],[0.0525,11_700,13_900],[0.0585,13_900,21_400],
            [0.0625,21_400,80_650],[0.0685,80_650,215_400],[0.0965,215_400,1_077_550],
            [0.103,1_077_550,5_000_000],[0.109,5_000_000,INF]],
        bM:[[0.04,0,17_150],[0.045,17_150,23_600],[0.0525,23_600,27_900],[0.0585,27_900,43_000],
            [0.0625,43_000,161_550],[0.0685,161_550,323_200],[0.0965,323_200,2_155_350],
            [0.103,2_155_350,5_000_000],[0.109,5_000_000,INF]],
        sdS:8_000, sdM:16_050, ex:1_000, exC:0
    },
    OK: {
        name:'Oklahoma',
        bS:[[0,0,1_000],[0.02,1_000,2_500],[0.045,2_500,INF]],
        bM:[[0,0,2_000],[0.02,2_000,5_000],[0.045,5_000,INF]],
        sdS:6_350, sdM:12_700, ex:1_000, exC:0
    },
    OR: {
        name:'Oregon',
        bS:[[0.0475,0,4_050],[0.0675,4_050,10_200],[0.0875,10_200,125_000],[0.099,125_000,INF]],
        bM:[[0.0475,0,8_100],[0.0675,8_100,20_400],[0.0875,20_400,250_000],[0.099,250_000,INF]],
        sdS:2_335, sdM:4_670, ex:0, exC:219
    },
    RI: {
        name:'Rhode Island',
        bS:[[0.0375,0,73_450],[0.0475,73_450,166_950],[0.0599,166_950,INF]],
        bM:[[0.0375,0,146_900],[0.0475,146_900,333_900],[0.0599,333_900,INF]],
        sdS:10_550, sdM:21_150, ex:4_700, exC:0
    },
    SC: {
        name:'South Carolina',
        bS:[[0,0,3_200],[0.03,3_200,6_410],[0.062,6_410,INF]],
        bM:'2x',
        sdS:F, sdM:FM, ex:4_080, exC:0
    },
    VT: {
        name:'Vermont',
        bS:[[0.0335,0,45_400],[0.066,45_400,110_050],[0.076,110_050,229_550],[0.0875,229_550,INF]],
        bM:[[0.0335,0,75_850],[0.066,75_850,183_400],[0.076,183_400,279_450],[0.0875,279_450,INF]],
        sdS:F, sdM:FM, ex:4_850, exC:0
    },
    VA: {
        name:'Virginia',
        bS:[[0.02,0,3_000],[0.03,3_000,5_000],[0.05,5_000,17_000],[0.0575,17_000,INF]],
        bM:null,
        sdS:4_500, sdM:9_000, ex:930, exC:0
    },
    WI: {
        name:'Wisconsin',
        bS:[[0.0354,0,14_320],[0.0465,14_320,28_640],[0.053,28_640,315_000],[0.0765,315_000,INF]],
        bM:[[0.0354,0,19_090],[0.0465,19_090,38_190],[0.053,38_190,420_420],[0.0765,420_420,INF]],
        sdS:0, sdM:0, ex:700, exC:0
    },
    WV: {
        name:'West Virginia',
        bS:[[0.0236,0,10_000],[0.0315,10_000,25_000],[0.0354,25_000,40_000],[0.0472,40_000,60_000],[0.0512,60_000,INF]],
        bM:'2x',
        sdS:0, sdM:0, ex:2_000, exC:0
    },
    DC: {
        name:'Washington D.C.',
        bS:[[0.04,0,10_000],[0.06,10_000,40_000],[0.065,40_000,60_000],
            [0.085,60_000,250_000],[0.0925,250_000,500_000],[0.1075,500_000,INF]],
        bM:'2x',
        sdS:F, sdM:FM, ex:1_675, exC:0
    },
};

// ─── Local / city income taxes (3-digit ZIP prefix) ───────────────────────────

const LOCAL_BY_PREFIX: Record<string, { city: string; rate: number }> = {
    '100':{ city:'New York City (Manhattan)',  rate:0.03876 },
    '101':{ city:'New York City (Manhattan)',  rate:0.03876 },
    '102':{ city:'New York City (Manhattan)',  rate:0.03876 },
    '103':{ city:'New York City (Staten Is.)', rate:0.03876 },
    '104':{ city:'New York City (Bronx)',      rate:0.03876 },
    '107':{ city:'Yonkers, NY',                rate:0.01675 },
    '111':{ city:'New York City (Queens)',     rate:0.03876 },
    '112':{ city:'New York City (Brooklyn)',   rate:0.03876 },
    '113':{ city:'New York City (Queens)',     rate:0.03876 },
    '114':{ city:'New York City (Queens)',     rate:0.03876 },
    '116':{ city:'New York City (Jamaica)',    rate:0.03876 },
    '152':{ city:'Pittsburgh, PA',             rate:0.030   },
    '185':{ city:'Scranton, PA',               rate:0.034   },
    '191':{ city:'Philadelphia, PA',           rate:0.0375  },
    '198':{ city:'Wilmington, DE',             rate:0.0125  },
    '206':{ city:"Prince George's Co., MD",    rate:0.032   },
    '207':{ city:"Prince George's Co., MD",    rate:0.032   },
    '208':{ city:'Montgomery Co., MD',         rate:0.032   },
    '209':{ city:'Montgomery Co., MD',         rate:0.032   },
    '210':{ city:'Anne Arundel Co., MD',       rate:0.0281  },
    '211':{ city:'Howard Co., MD',             rate:0.032   },
    '212':{ city:'Baltimore City, MD',         rate:0.032   },
    '430':{ city:'Columbus, OH',               rate:0.025   },
    '431':{ city:'Columbus, OH',               rate:0.025   },
    '432':{ city:'Columbus, OH',               rate:0.025   },
    '436':{ city:'Toledo, OH',                 rate:0.0225  },
    '441':{ city:'Cleveland, OH',              rate:0.025   },
    '443':{ city:'Akron, OH',                  rate:0.025   },
    '445':{ city:'Youngstown, OH',             rate:0.026   },
    '452':{ city:'Cincinnati, OH',             rate:0.018   },
    '454':{ city:'Dayton, OH',                 rate:0.025   },
    '460':{ city:'Hamilton Co., IN',           rate:0.011   },
    '462':{ city:'Marion Co. (Indianapolis)',  rate:0.0202  },
    '463':{ city:'Lake Co., IN',               rate:0.015   },
    '464':{ city:'Lake Co., IN',               rate:0.015   },
    '468':{ city:'Allen Co. (Fort Wayne), IN', rate:0.0148  },
    '482':{ city:'Detroit, MI',                rate:0.024   },
    '485':{ city:'Flint, MI',                  rate:0.010   },
    '486':{ city:'Saginaw, MI',                rate:0.015   },
    '489':{ city:'Lansing, MI',                rate:0.010   },
    '495':{ city:'Grand Rapids, MI',           rate:0.015   },
    '402':{ city:'Louisville, KY',             rate:0.022   },
    '405':{ city:'Lexington, KY',              rate:0.0225  },
    '410':{ city:'Covington, KY',              rate:0.025   },
    '421':{ city:'Bowling Green, KY',          rate:0.0175  },
    '631':{ city:'St. Louis, MO',              rate:0.010   },
    '641':{ city:'Kansas City, MO',            rate:0.010   },
    '352':{ city:'Birmingham, AL',             rate:0.010   },
    '359':{ city:'Gadsden, AL',                rate:0.020   },
    '970':{ city:'Portland Metro, OR',         rate:0.010   },
    '971':{ city:'Portland Metro, OR',         rate:0.010   },
    '972':{ city:'Multnomah Co., OR',          rate:0.025   },
};

// ─── ZIP → State ──────────────────────────────────────────────────────────────

export function zipToState(zip: string): string | null {
    if (!/^\d{5}$/.test(zip)) return null;
    const p = parseInt(zip.slice(0, 3), 10);
    if (p >= 10  && p <= 27 ) return 'MA';
    if (p >= 28  && p <= 29 ) return 'RI';
    if (p >= 30  && p <= 38 ) return 'NH';
    if (p >= 39  && p <= 49 ) return 'ME';
    if (p >= 50  && p <= 59 ) return 'VT';
    if (p >= 60  && p <= 69 ) return 'CT';
    if (p >= 70  && p <= 89 ) return 'NJ';
    if (p >= 100 && p <= 149) return 'NY';
    if (p >= 150 && p <= 196) return 'PA';
    if (p >= 197 && p <= 199) return 'DE';
    if (p === 200 || (p >= 202 && p <= 205)) return 'DC';
    if (p === 201 || (p >= 206 && p <= 212) || (p >= 214 && p <= 219)) return 'MD';
    if (p >= 220 && p <= 246) return 'VA';
    if (p >= 247 && p <= 268) return 'WV';
    if (p >= 270 && p <= 289) return 'NC';
    if (p >= 290 && p <= 299) return 'SC';
    if (p >= 300 && p <= 319) return 'GA';
    if (p >= 320 && p <= 349) return 'FL';
    if (p >= 350 && p <= 369) return 'AL';
    if (p >= 370 && p <= 385) return 'TN';
    if (p >= 386 && p <= 399) return 'MS';
    if (p === 419 || (p >= 430 && p <= 459)) return 'OH';
    if ((p >= 400 && p <= 418) || (p >= 420 && p <= 427)) return 'KY';
    if (p >= 460 && p <= 479) return 'IN';
    if (p >= 480 && p <= 499) return 'MI';
    if (p >= 500 && p <= 528) return 'IA';
    if (p >= 530 && p <= 549) return 'WI';
    if (p >= 550 && p <= 567) return 'MN';
    if (p >= 570 && p <= 577) return 'SD';
    if (p >= 580 && p <= 588) return 'ND';
    if (p >= 590 && p <= 599) return 'MT';
    if ((p >= 600 && p <= 620) || (p >= 622 && p <= 629)) return 'IL';
    if ((p >= 630 && p <= 631) || (p >= 633 && p <= 658)) return 'MO';
    if (p >= 660 && p <= 679) return 'KS';
    if (p >= 680 && p <= 693) return 'NE';
    if (p >= 700 && p <= 714) return 'LA';
    if (p >= 716 && p <= 729) return 'AR';
    if ((p >= 730 && p <= 732) || (p >= 734 && p <= 749)) return 'OK';
    if (p === 733 || (p >= 750 && p <= 799) || p === 885) return 'TX';
    if (p >= 800 && p <= 816) return 'CO';
    if (p >= 820 && p <= 831) return 'WY';
    if (p >= 832 && p <= 838) return 'ID';
    if (p >= 840 && p <= 847) return 'UT';
    if (p >= 850 && p <= 865) return 'AZ';
    if (p >= 870 && p <= 884) return 'NM';
    if (p >= 889 && p <= 898) return 'NV';
    if (p >= 900 && p <= 961) return 'CA';
    if (p >= 967 && p <= 968) return 'HI';
    if (p >= 970 && p <= 979) return 'OR';
    if (p >= 980 && p <= 994) return 'WA';
    if (p >= 995 && p <= 999) return 'AK';
    return null;
}

// ─── Tax Engine ───────────────────────────────────────────────────────────────

function calcBrackets(taxable: number, brackets: Bracket[]): number {
    if (taxable <= 0 || !Array.isArray(brackets)) return 0;
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const rate = brackets[i][0];
        const lo   = brackets[i][1];
        const hi   = brackets[i][2];
        if (taxable <= lo) break;
        tax += (Math.min(taxable, hi) - lo) * rate;
    }
    return tax;
}

function getStateBrackets(sd: SD, filing: 'single' | 'married'): Bracket[] {
    if (filing === 'single' || sd.bM === null) return sd.bS;
    if (sd.bM === '2x') {
        return sd.bS.map(b => [b[0], b[1] === 0 ? 0 : b[1] * 2, b[2] === INF ? INF : b[2] * 2] as Bracket);
    }
    return sd.bM as Bracket[];
}

export function computeMonthlyTakeHome(
    grossMonthly: number,
    filingRaw: string,
    k401Monthly: number,
    iraAnnual: number,
    itemizedAnnual: number,
    zip: string
): { takeHome: number; stateCode: string | null; localInfo: { city: string; rate: number } | undefined } {
    const filing: 'single' | 'married' = filingRaw === 'married' ? 'married' : 'single';
    const stateCode = zip.length === 5 ? zipToState(zip) : null;
    const localInfo = zip.length >= 3 ? LOCAL_BY_PREFIX[zip.slice(0, 3)] : undefined;
    const localRate = localInfo?.rate ?? 0;

    if (!stateCode || !(filing in FEDERAL_BRACKETS)) {
        return { takeHome: 0, stateCode, localInfo };
    }

    const gross   = grossMonthly * 12;
    const c401    = Math.min(k401Monthly * 12, LIMIT_401K);
    const cIRA    = Math.min(iraAnnual, LIMIT_IRA);
    const numEx   = filing === 'married' ? 2 : 1;

    const fedDed     = Math.max(itemizedAnnual, FED_STD_DED[filing]);
    const fedTaxable = Math.max(0, gross - c401 - cIRA - fedDed);
    const fedTax     = calcBrackets(fedTaxable, FEDERAL_BRACKETS[filing] as Bracket[]);

    const ficaBase  = Math.max(0, gross - c401);
    const ss        = Math.min(ficaBase, SS_WAGE_BASE) * 0.062;
    const medThresh = filing === 'single' ? 200_000 : 250_000;
    let   medicare  = ficaBase * 0.0145;
    if (ficaBase > medThresh) medicare += (ficaBase - medThresh) * 0.009;

    const sd           = STATES[stateCode];
    const stateAGI     = Math.max(0, gross - c401 - cIRA);
    const stateSded    = filing === 'married' ? sd.sdM : sd.sdS;
    const stateExDed   = numEx * sd.ex;
    const stateTaxable = Math.max(0, stateAGI - Math.max(stateSded, itemizedAnnual) - stateExDed);
    const stateBracks  = getStateBrackets(sd, filing);
    const stateTax     = Math.max(0, calcBrackets(stateTaxable, stateBracks) - numEx * sd.exC);

    const localTax  = ficaBase * localRate;
    const totalTax  = fedTax + stateTax + localTax + ss + medicare;
    const takeHome  = (gross - c401 - cIRA - totalTax) / 12;

    return { takeHome, stateCode, localInfo };
}
