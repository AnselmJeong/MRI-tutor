// English terminology: FIPAT Terminologia Neuroanatomica (2017), Ch. 1,
// https://libraries.dal.ca/Fipat/tna.html and the installed Atlas label definitions.
// A named subpart deliberately has no location unless its own mask is available.
const entries = `
조가비핵|putamen|0|putamen
미상핵|caudate nucleus|1|caudate
꼬리핵|caudate nucleus|1|caudate
측좌핵|nucleus accumbens|2|accumbens
확장 편도체|extended amygdala|3|
창백핵 바깥분절|external segment of the globus pallidus|4|
창백핵 안쪽분절|internal segment of the globus pallidus|5|
창백핵|globus pallidus|4,5|pallidum
담창구|globus pallidus|4,5|pallidum
흑질 치밀부|substantia nigra pars compacta|6|
적핵|red nucleus|7|
흑질 망상부|substantia nigra pars reticulata|8|
흑질|substantia nigra|6,8|
치밀부|pars compacta||
안쪽분절|internal segment||
바깥분절|external segment||
팔곁색소핵|parabrachial pigmented nucleus|9|
팔곁핵|parabrachial nucleus||
복측피개영역|ventral tegmental area|10|
배쪽 창백핵|ventral pallidum|11|
등쪽 창백핵|dorsal pallidum|4,5|pallidum
고삐핵|habenular nucleus|12|
시상하부|hypothalamus|13|
유두핵|mammillary nucleus|14|
시상밑핵|subthalamic nucleus|15|
편도체|amygdala|16|amygdala
해마|hippocampus|17|hippocampus
전대상회 배측부|dorsal anterior cingulate cortex|20|
전대상회|anterior cingulate cortex|18|
후대상회|posterior cingulate cortex|19|
대상피질|cingulate cortex|18,19|cingulate
대상회|cingulate gyrus|18,19|cingulate
뇌섬엽 피질|insular cortex|21|insula
뇌섬엽|insula|21|insula
배외측 전전두엽|dorsolateral prefrontal cortex|22|
안와전두피질|orbitofrontal cortex|23|orbitofrontal
복내측 전전두엽|ventromedial prefrontal cortex|24|
보완운동영역|supplementary motor area|25|
쐐기앞소엽|precuneus|26|precuneus
하두정소엽|inferior parietal lobule|27|
하두정 영역|inferior parietal region|27|inferior-parietal
시상 앞배쪽핵|anteroventral thalamic nucleus|38|
시상 앞핵군|anterior thalamic nuclei||
시상 앞핵|anterior thalamic nuclei||
앞핵군|anterior thalamic nuclei||
앞핵|anterior nucleus||
시상핵|thalamic nuclei||
시상|thalamus|28|thalamus
유두체|mammillary body|29|
마이네르트 기저핵|nucleus basalis of Meynert|30|
청반|locus coeruleus|31|
각교뇌피개핵|pedunculopontine nucleus|32|
수도관주위 회색질|periaqueductal gray|33|
등쪽 봉선핵|dorsal raphe nucleus|34|
정중 봉선핵|median raphe nucleus|35|
봉선핵|raphe nuclei||
소뇌 충부|cerebellar vermis|36|
충부|vermis|36|
뇌궁·해마술|fornix and fimbria|37|
뇌궁|fornix||
해마술|fimbria of the hippocampus||
해마곁이랑|parahippocampal gyrus|39|parahippocampal
해마곁 피질|parahippocampal cortex|39|parahippocampal
해마곁 영역|parahippocampal region||
담장|claustrum|40|
중격 영역|septal region|41|
외측중격핵|lateral septal nucleus||
최외포|extreme capsule||
외포|external capsule||
내포 앞다리|anterior limb of the internal capsule||
내포 뒷다리|posterior limb of the internal capsule||
내포 뒤다리|posterior limb of the internal capsule||
내포 무릎|genu of the internal capsule||
내포|internal capsule||internal-capsule
렌즈핵|lentiform nucleus|0,4,5|
기저핵|basal nuclei||
배쪽 선조체|ventral striatum||
복측 선조체|ventral striatum||
등쪽 선조체|dorsal striatum|0,1|
선조체|striatum||
기저전뇌|basal forebrain||
상시상|epithalamus||
앞뇌|forebrain||
중뇌 피개|midbrain tegmentum||
교뇌 피개|pontine tegmentum||
중뇌|midbrain||
위교뇌|upper pons||
교뇌|pons||
뇌교|pons||
연수|medulla oblongata||
척수|spinal cord||
뇌간|brainstem||brainstem
소뇌 피질|cerebellar cortex||cerebellar-cortex
소뇌 백질|cerebellar white matter||
소뇌반구|cerebellar hemisphere||
소뇌 잎|cerebellar folia||
소뇌|cerebellum||
위소뇌다리|superior cerebellar peduncle||
대뇌수도관|cerebral aqueduct||
수도관|cerebral aqueduct||
측뇌실 전각|anterior horn of the lateral ventricle||
측뇌실 측두각|temporal horn of the lateral ventricle||temporal-horn
측뇌실 하각|inferior horn of the lateral ventricle||temporal-horn
측두각|temporal horn||temporal-horn
전각|anterior horn||
측뇌실|lateral ventricle||ventricle
제3뇌실|third ventricle||third-ventricle
제4뇌실|fourth ventricle||fourth-ventricle
뇌실|ventricle||
뇌량 팽대부|splenium of the corpus callosum||
뇌량 팽대|splenium of the corpus callosum||
뇌량 무릎|genu of the corpus callosum||
뇌량 몸통|body of the corpus callosum||
뇌량 부리|rostrum of the corpus callosum||
뇌량고랑|callosal sulcus||
뇌량구|callosal sulcus||
뇌량|corpus callosum||callosum
대상고랑 변연가지|marginal branch of the cingulate sulcus||
대상고랑의 변연가지|marginal branch of the cingulate sulcus||
대상구 변연가지|marginal branch of the cingulate sulcus||
대상고랑|cingulate sulcus||
대상구|cingulate sulcus||
변연가지|marginal branch||
내측 측두엽|medial temporal lobe||
내측 전두피질|medial frontal cortex||
전전두피질|prefrontal cortex||
전두피질|frontal cortex||
전두엽|frontal lobe||
두정엽|parietal lobe||
측두엽|temporal lobe||
후두엽|occipital lobe||
변연계|limbic system||
내후각피질|entorhinal cortex||entorhinal
중전두회|middle frontal gyrus||middle-frontal
상전두회|superior frontal gyrus||superior-frontal
내측 안와상전두회|medial orbital superior frontal gyrus||
상전두고랑|superior frontal sulcus||
하전두고랑|inferior frontal sulcus||
중심앞고랑|precentral sulcus||
중심고랑|central sulcus||
중심뒤고랑|postcentral sulcus||
중심앞이랑|precentral gyrus||precentral
중심뒤이랑|postcentral gyrus||postcentral
외측고랑|lateral sulcus||
외측구|lateral sulcus||
상측두고랑|superior temporal sulcus||
상측두구|superior temporal sulcus||
상측두회|superior temporal gyrus||
두정내고랑|intraparietal sulcus||
두정후두고랑|parieto-occipital sulcus||
두정후두구|parieto-occipital sulcus||
쐐기소엽|cuneus||
모서리이랑|angular gyrus||
각회|angular gyrus||
모서리위이랑|supramarginal gyrus||
연상회|supramarginal gyrus||
방추상회|fusiform gyrus||
곁고랑|collateral sulcus||
대뇌 종열|longitudinal cerebral fissure||
대뇌종열|longitudinal cerebral fissure||
종열|longitudinal fissure||
전두극|frontal pole||
안와면|orbital surface||
안와회|orbital gyrus||
직회|gyrus rectus||
후각구|olfactory sulcus||
안와|orbit||
전교련|anterior commissure||
전유공질|anterior perforated substance||
투명중격|septum pellucidum||
큰수조|cisterna magna||
후두와|posterior cranial fossa||
뇌궁 몸통|body of the fornix||
뇌궁 기둥|column of the fornix||
뇌궁 다리|crus of the fornix||
유두시상로|mammillothalamic tract||
대상다발|cingulum bundle||
해마 머리|head of the hippocampus||
해마 몸통|body of the hippocampus||
해마 꼬리|tail of the hippocampus||
미상핵 머리|head of the caudate nucleus||
피질|cortex||
회백질|gray matter||
회색질|gray matter||
백질|white matter||
덮개|operculum||
대뇌|cerebrum||
신경세포|neuron||
배외측 상전두회|dorsolateral superior frontal gyrus||
상외측면|superolateral surface|-|
배외측|dorsolateral|-|
후내측|posteromedial|-|
정중시상면|midsagittal plane|-|
정중|midline|-|
고랑|sulcus|-|
이랑|gyrus|-|
심부핵|deep nuclei||
소엽|lobule|-|
정중 시상면|midsagittal plane|-|
관상 사위면|oblique coronal plane|-|
시상면|sagittal plane|-|
관상면|coronal plane|-|
축상면|axial plane|-|
정중선|midline|-|
가쪽|lateral|-|
바깥쪽|lateral|-|
안쪽|medial|-|
내측|medial|-|
외측|lateral|-|
등쪽|dorsal|-|
배쪽|ventral|-|
복측|ventral|-|
머리|head|-|
몸통|body|-|
꼬리|tail|-|
무릎|genu|-|
팽대부|splenium|-|
앞다리|anterior limb|-|
뒷다리|posterior limb|-|
뒤다리|posterior limb|-|
`.trim().split('\n').map(line=>{
  const [ko,en,atlas,topic]=line.split('|');
  return Object.freeze({ko,en,groups:atlas&&atlas!=='-'?atlas.split(',').map(Number):[],topic:topic||null,locatable:atlas!=='-'});
});
export const anatomyTerms=Object.freeze(entries);
const byKorean=new Map(entries.map(term=>[term.ko,term]));
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp(`(${entries.map(t=>t.ko).sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|')})(\\s*\\([^()]*[A-Za-z][^()]*\\))?`,'g');

export function anatomySegments(text){
  const parts=[];let last=0;
  // Plane labels are not the thalamus; keep this disambiguation explicit.
  text=text.replace(/Axial · 축상/g,'축상면(axial plane)').replace(/Coronal · 관상/g,'관상면(coronal plane)').replace(/Sagittal · 시상/g,'시상면(sagittal plane)');
  for(const match of text.matchAll(pattern)){
    if(match.index>last)parts.push(text.slice(last,match.index));
    const term=byKorean.get(match[1]);
    parts.push({term,english:match[2]?match[2].trim().slice(1,-1):term.en});
    last=match.index+match[0].length;
  }
  if(last<text.length)parts.push(text.slice(last));
  return parts;
}
export const anatomyText=text=>anatomySegments(text).map(p=>typeof p==='string'?p:`${p.term.ko}(${p.english})`).join('');

export function annotateAnatomy(root,{onLocate,canLocate=()=>false,enabled=true}={}){
  const doc=root.ownerDocument,walker=doc.createTreeWalker(root,4),nodes=[];
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.parentElement.closest('a,button,textarea,input,select,script,style,.english,[data-user-content],[data-anatomy-term],[contenteditable]'))nodes.push(node);
  }
  for(const node of nodes){
    const parts=anatomySegments(node.data);if(!parts.some(p=>typeof p!=='string'))continue;
    const fragment=doc.createDocumentFragment();
    for(const part of parts){
      if(typeof part==='string'){fragment.append(part);continue;}
      const {term,english}=part,link=Boolean(onLocate&&term.locatable&&canLocate(term));
      const el=doc.createElement(link?'button':'span');el.dataset.anatomyTerm=term.ko;
      if(link){el.type='button';el.className='anatomy-link';el.disabled=!enabled;el.title=enabled?'MRI에서 위치 표시':'답을 확인한 뒤 위치를 볼 수 있습니다';el.onclick=()=>onLocate(term);}
      el.append(term.ko);const en=doc.createElement('span');en.className='anatomy-english';en.textContent=`(${english})`;el.append(en);fragment.append(el);
    }
    node.replaceWith(fragment);
  }
  // The heading now includes its English; remove the former duplicated line.
  root.querySelectorAll('h2 + .english').forEach(el=>{if(el.previousElementSibling.querySelector('[data-anatomy-term]'))el.remove();});
}
