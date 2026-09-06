// Korean educational notes; atlas terminology is retained in English.
export const regions = [
 ['조가비핵','Putamen','선조체의 일부로, 운동과 학습에 관여하는 기저핵 회로에 참여합니다.','창백핵보다 가쪽에 있습니다. 미상핵과 함께 등쪽 선조체를 이룹니다.'],
 ['미상핵','Caudate','머리·몸통·꼬리가 이어지는 굽은 구조입니다. 운동뿐 아니라 인지와 학습 회로에도 참여합니다.','머리는 측뇌실 전각에 인접합니다. 렌즈핵과의 사이에 내포 앞다리가 놓입니다.'],
 ['측좌핵','Nucleus accumbens','배쪽 선조체에 속하며 동기와 보상 관련 학습 회로에 참여합니다.','미상핵과 조가비핵이 만나는 배쪽 영역을 기준으로 위치를 살펴보세요.'],
 ['확장 편도체','Extended amygdala','서로 연결된 편도체 관련 영역을 묶는 개념입니다. 이 atlas의 라벨은 편도체 전체를 뜻하지 않습니다.','일반적인 편도체 라벨과 같은 것으로 외우지 말고, atlas의 정의와 범위를 함께 확인하세요.'],
 ['창백핵 바깥분절','Globus pallidus externa','기저핵 회로의 구성 요소입니다. 안쪽분절과 공간적으로 구분해 익혀 보세요.','조가비핵과 창백핵 안쪽분절 사이에 놓입니다.'],
 ['창백핵 안쪽분절','Globus pallidus interna','기저핵의 주요 출력 구조 중 하나입니다.','창백핵 바깥분절보다 안쪽에 있으며, 내포와의 관계를 함께 살펴보세요.'],
 ['흑질 치밀부','Substantia nigra pars compacta','중뇌의 도파민 신경세포가 풍부한 영역으로, 선조체와 연결됩니다.','흑질 망상부와 가까이 있습니다. 일상적인 T1 한 장에서 atlas의 세부 경계가 그대로 보이는 것은 아닙니다.'],
 ['적핵','Red nucleus','중뇌 피개에 있는 핵으로 운동 관련 연결을 갖습니다.','흑질보다 등쪽의 중뇌 영역에서 양측 위치를 확인하세요.'],
 ['흑질 망상부','Substantia nigra pars reticulata','기저핵의 출력에 관여하는 흑질 영역입니다.','도파민 신경세포가 풍부한 치밀부와 구별합니다. 두 영역의 이름과 상대 위치를 연결하세요.'],
 ['팔곁색소핵','Parabrachial pigmented nucleus','중뇌 도파민계의 작은 핵입니다. 이 atlas는 인접한 복측피개영역과 별도 라벨로 구분합니다.','뇌교의 팔곁핵(parabrachial nucleus)과 이름이 비슷하므로 혼동하지 마세요.'],
 ['복측피개영역','Ventral tegmental area','중뇌의 영역으로 동기·보상 관련 회로와 연결됩니다.','흑질에 비해 더 안쪽의 중뇌 영역을 기준으로 살펴보세요.'],
 ['배쪽 창백핵','Ventral pallidum','배쪽 선조체와 연결되는 기저전뇌 영역입니다.','등쪽 창백핵의 두 분절과 구분하여, 측좌핵 주변의 배쪽 위치를 관찰하세요.'],
 ['고삐핵','Habenular nucleus','상시상의 작은 핵으로 여러 앞뇌·중뇌 회로를 잇습니다.','뒤쪽 정중선 가까이에 있는 작은 양측 구조입니다. 크기보다 위치 관계에 집중하세요.'],
 ['시상하부','Hypothalamus','항상성, 자율신경 및 내분비 조절에 관여하는 영역입니다.','제3뇌실 아래쪽의 정중선 주변을 기준으로 위치를 살펴보세요. 이 라벨은 개별 시상하부 핵 지도가 아닙니다.'],
 ['유두핵','Mammillary nucleus','시상하부 뒤아래쪽의 유두체와 관련된 핵으로 기억 관련 회로에 참여합니다.','시상하부보다 뒤아래쪽에 놓인 작은 양측 구조를 찾아보세요.'],
 ['시상밑핵','Subthalamic nucleus','기저핵 회로에 참여하는 작은 핵입니다.','시상의 아래, 흑질의 위쪽에 있는 영역입니다. 시상하부와 다른 구조입니다.']
].map(([ko,en,description,relation],i)=>({group:i,ko,en,description,relation}));
export const palette = ['#c59769','#90a580','#cb997f','#b78898','#b8aa76','#a68b64','#759894','#c28c77','#839fbb','#b0a0bd','#90b6ab','#bd9cb2','#9dac7d','#a0b6bb','#c9b475','#7ca597'];

const additions = [
 ['편도체','Amygdala','해마 머리의 앞위쪽에 놓인 내측 측두엽 회백질입니다. 확장 편도체와 별도 구조입니다.','관상면에서 측두각과 해마 머리를 먼저 찾고 앞쪽 절편으로 이동하세요. 시상면에서 해마와의 전후 관계, 축상면에서 uncus와의 관계를 확인합니다.','anatomy'],
 ['해마','Hippocampus','측뇌실 측두각 바닥을 따라 굽는 구조입니다. 머리·몸통·꼬리를 연속 절편으로 추적합니다.','관상면에서 측두각 아래 해마를 찾습니다. 앞쪽 머리에서 뒤쪽 몸통으로 이동하며 단면이 작아지는 과정을 관찰하세요. 시상면에서 장축의 곡률을 확인합니다.','anatomy'],
 ['전대상회','ACC · Anterior cingulate cortex','이 앱에서는 AAL3의 subgenual, pregenual, supracallosal ACC를 합쳐 표시합니다.','시상면에서 뇌량 무릎을 찾고 그 아래·앞·위의 대상피질을 구분하세요. 관상면에서는 정중선 양측, 뇌량 위의 대상구와 뇌량구 사이입니다.','parcel'],
 ['후대상회','PCC · Posterior cingulate cortex','뇌량 팽대 뒤위쪽 대상피질입니다. Precuneus와 인접하지만 같은 영역은 아닙니다.','정중 시상면에서 뇌량 팽대를 기준으로 찾습니다. 뒤위쪽 precuneus 및 아래쪽 retrosplenial 영역과의 상대 위치를 확인하세요.','parcel'],
 ['전대상회 배측부','dACC · Supracallosal ACC proxy','AAL3의 supracallosal ACC를 표시합니다. 문헌의 dACC 경계와 완전히 일치하는 보편적 구획은 아닙니다.','시상면에서 뇌량 몸통 앞부분 바로 위, 대상구 아래를 따라갑니다. SMA는 더 위뒤쪽 내측 전두피질에 위치합니다.','proxy'],
 ['뇌섬엽','Insula','외측구 깊숙이 놓인 피질입니다. 주변 operculum을 통과한 관상·축상 절편에서 찾습니다.','가쪽부터 뇌섬엽 피질 → 최외포 → 담장 → 외포 → 조가비핵 순서를 확인하세요. 이 얇은 층들의 경계는 영상 해상도에 영향을 받습니다.','anatomy'],
 ['배외측 전전두엽','dlPFC · Macroanatomical proxy','AAL3의 중전두회와 배외측 상전두회 합집합을 위치 학습용으로 표시합니다. 기능적으로 정의한 dlPFC 전체와 동일하지 않습니다.','축상면에서 전두엽 상외측면, 시상면에서 중심앞고랑보다 앞쪽 전두피질을 확인합니다. MRI 신호만으로 기능적 dlPFC 경계를 확정할 수 없습니다.','proxy'],
 ['안와전두피질','OFC · Orbitofrontal cortex','AAL3의 내측·앞·뒤·가쪽 안와전두 구획을 합친 영역입니다.','아래쪽 축상면에서 안와 위 전두엽 기저부를 찾습니다. 관상면에서는 후각구와 직회, 내측 및 외측 안와회를 함께 확인하세요.','parcel'],
 ['복내측 전전두엽','vmPFC · Macroanatomical proxy','내측 안와상전두회와 직회를 위치 학습용으로 표시합니다. 연구별 vmPFC 정의는 이 구획보다 넓거나 다를 수 있습니다.','정중선 가까운 시상면에서 전두극 아래쪽 및 안와면을 확인합니다. OFC와 vmPFC는 정의에 따라 겹칠 수 있습니다.','proxy'],
 ['보완운동영역','SMA · Supplementary motor area','AAL3의 보완운동영역 구획입니다. pre-SMA와 SMA proper를 별도 분할하지 않습니다.','시상면에서 중심앞이랑 내측 부분보다 앞쪽, 대상구보다 위쪽을 찾습니다. 관상면에서 대뇌종열 양측의 내측 전두피질입니다.','parcel'],
 ['쐐기앞소엽','Precuneus','내측 두정엽 피질로, 후대상회보다 위쪽에 위치합니다.','정중 시상면에서 두정후두구 앞쪽, 대상구 변연가지 뒤쪽을 확인합니다. 아래쪽 PCC와 함께 DMN의 후내측 영역을 관찰하세요.','anatomy'],
 ['하두정소엽','IPL · Angular + supramarginal','AAL3 하두정 구획, 모서리이랑(각회), 모서리위이랑(연상회)을 합칩니다.','외측구 뒤끝을 감싸는 supramarginal gyrus와 상측두구 뒤끝 주변 angular gyrus를 구별하세요. 한 절편보다 연속 축상·시상면 추적이 유용합니다.','parcel'],
 ['시상','Thalamus','AAL3 시상 하위 구획의 합집합입니다. 전체 시상과 앞핵의 위치를 별도로 학습할 수 있습니다.','축상면에서 제3뇌실 양측, 내포 뒤다리 안쪽을 찾습니다. 관상면에서는 아래의 시상하부 및 위가쪽의 측뇌실과의 관계를 확인하세요.','anatomy'],
 ['유두체','Mammillary body','CoBrA의 유두체 분할입니다. 기존 CIT168 유두핵 라벨과 범위가 다릅니다.','정중선 가까운 시상면에서 시상하부 뒤아래, 중뇌 앞의 작은 돌기를 찾습니다. 관상면에서 쌍을 이루는 위치와 뇌궁 기둥의 연결을 확인하세요.','anatomy'],
 ['마이네르트 기저핵','Nucleus basalis of Meynert · Ch4','Julich의 기저전뇌 Ch4 구획입니다. 미상핵(caudate nucleus)과 다른 구조입니다.','전교련·전유공질 주변의 기저전뇌에서 위치를 추정합니다. 일상 T1에서 Ch4의 세포구축학적 경계를 직접 구별하는 과제로 해석하지 마세요.','micro'],
 ['청반','Locus coeruleus','AAN v2의 양측 LC를 표준 공간으로 옮긴 구획입니다. 정합 경계는 근사치입니다.','제4뇌실 바닥 가까운 등쪽 위교뇌에서 위치를 추정합니다. 일반 T1의 명확한 핵 경계가 아니며, 직접 시각화에는 neuromelanin MRI 등 별도 대비가 사용됩니다.','micro'],
 ['각교뇌피개핵','PPTN / PTg · Pedunculopontine nucleus','AAN v2 pedunculotegmental 구획입니다. 중뇌 아래–상부 교뇌 피개의 작은 핵입니다.','위소뇌다리와 중뇌–교뇌 이행부를 기준으로 위치 관계를 봅니다. 일반 T1에서 분명한 외곽선을 확인하는 과제가 아닌 atlas 위치 추정 과제입니다.','micro'],
 ['수도관주위 회색질','PAG · Periaqueductal gray','AAN v2 PAG 구획입니다. 중뇌 대뇌수도관 주변 영역을 표시합니다.','축상면에서 중뇌 정중선의 수도관을 먼저 찾습니다. 그 둘레 회색질의 위치를 보고 시상면에서 제3뇌실–수도관–제4뇌실의 연속성을 확인하세요.','micro'],
 ['등쪽 봉선핵','Dorsal raphe nucleus','AAN v2의 dorsal raphe 구획입니다. 모든 뇌간 봉선핵을 대표하는 전체 분할은 아닙니다.','중뇌 정중선에서 수도관 및 PAG와의 관계를 봅니다. 이 분할은 조직학적 핵 위치의 atlas 추정이며 일반 T1의 직접 식별 경계가 아닙니다.','micro'],
 ['정중 봉선핵','Median raphe nucleus','AAN v2의 median raphe 구획입니다. 등쪽 봉선핵과 따로 표시합니다.','뇌간 정중선에서 등쪽 봉선핵에 대한 아래·배쪽 위치를 확인하세요. 봉선핵 전체 B1–B9를 포함하지 않습니다.','micro'],
 ['소뇌 충부','Cerebellar vermis','AAL3 충부 I–X 구획의 합집합입니다. 좌우 한 쌍이 아닌 정중 구조입니다.','정중 시상면에서 제4뇌실 뒤의 소뇌 충부를 확인합니다. 관상면에서 양측 소뇌반구 사이 중앙 부분을 연속 추적하세요.','anatomy'],
 ['뇌궁·해마술','Fornix + fimbria','CoBrA 뇌궁과 해마술 합집합입니다. MRI에서 보이는 주요 백질 다발 위치를 연결합니다.','시상면에서 뇌량 아래의 뇌궁 몸통을 찾고, 앞쪽 기둥과 뒤쪽 다리를 추적하세요. 표시된 atlas 분할이 전체 Papez 경로를 끊김 없이 재현하지는 않습니다.','anatomy'],
 ['시상 앞배쪽핵','Anterior ventral thalamic nucleus','시상 앞핵군 중 anteroventral nucleus 분할입니다. 앞핵군 전체와 동일하지 않습니다.','관상·축상면에서 시상 앞위쪽, 제3뇌실 및 측뇌실 사이를 확인합니다. 유두체와 대상회 사이 Papez 회로의 한 노드입니다.','micro'],
 ['해마곁이랑','Parahippocampal gyrus','AAL3 해마곁이랑 구획입니다. 내후각피질의 세포구축학적 경계를 별도로 제공하지 않습니다.','관상면에서 해마 아래 내측 측두엽 피질을 찾고, 가쪽 collateral sulcus와의 관계를 확인합니다.','anatomy'],
 ['담장','Claustrum','Allen Human Reference Atlas의 담장입니다. 이 구조를 선택하면 맞춤 ICBM2009b symmetric MRI로 전환됩니다.','축상·관상면에서 조가비핵과 뇌섬엽 사이의 얇은 회백질판입니다. 가쪽 최외포, 안쪽 외포를 구분하며 관찰하세요. 해상도에 따른 부분용적 효과가 큽니다.','anatomy'],
 ['중격 영역 · LSN 참고','Septal region · not isolated LSN','Allen의 septal region을 참고용으로 표시합니다. 외측중격핵만을 분할한 자료가 아니므로 LSN 식별 채점에는 사용하지 않습니다.','전교련 위쪽, 뇌량 부리 아래 및 투명중격 기저부 주변의 중격 영역을 확인하세요. 이 영역 전체를 외측중격핵의 경계로 외우면 안 됩니다.','reference']
];
for(const [ko,en,description,relation,kind] of additions) regions.push({group:regions.length,ko,en,description,relation,kind});
for(const r of regions){r.kind??= [3,4,5,6,8,9,10,12,14,15].includes(r.group)?'micro':'anatomy';r.space=r.group>=40?'allen':'mni';r.midline=[33,34,35,36].includes(r.group);r.trainable=r.kind!=='reference';}
while(palette.length<regions.length)palette.push(palette[palette.length%16]);
export const kindNames={anatomy:'해부학적 구조',parcel:'Atlas 구획',proxy:'기능 영역의 위치 참고',micro:'미세 구조 · atlas 위치 추정',reference:'참고 영역 · 단독 핵 분할 없음'};
export const networks={
 dmn:{name:'DMN',description:'기능적 네트워크의 주요 위치를 연결합니다. 구조 MRI만으로 개인의 DMN을 확정할 수 없으며 기능적 연결성 측정 결과가 아닙니다.',nodes:[24,19,26,27],steps:['내측 전전두 위치 참고(vmPFC proxy)','후대상회','Precuneus','하두정소엽'],edge:'이 연결은 개념적 관계이며 실제 백질 섬유 경로를 표시하지 않습니다.'},
 cstc:{name:'CSTC',description:'인지·보상·운동 회로에는 서로 다른 병렬 루프가 있습니다. 여기서는 주요 피질–기저핵–시상 노드를 비교합니다.',nodes:[22,1,0,2,5,8,28],steps:['전전두피질 위치 참고','미상핵','조가비핵','복측 선조체: 측좌핵','출력: GPi','출력: SNr','시상 → 피질'],edge:'직접·간접·초직접 경로를 하나의 직렬 경로로 해석하지 마세요. 목록은 노드 집합입니다.'},
 papez:{name:'Papez',description:'기억 회로의 거시적 위치를 순서대로 추적합니다. 시상 앞핵은 앞배쪽핵 구획으로 표시합니다.',nodes:[17,37,29,38,18,39],steps:['해마','뇌궁·해마술','유두체','시상 앞배쪽핵','대상회: ACC 선택; PCC도 탐색','해마곁이랑 → 내후각피질 → 해마'],edge:'유두시상로·대상다발·내후각피질은 이 연결 순서에 포함되지만 별도 전체 경로 분할은 제공하지 않습니다.'}
};
