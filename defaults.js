// 첫 실행과 연결 장애 때 사용할 기본 안내입니다. 정상 연결 후에는 구글 시트가 우선합니다.
(() => {
  const asset = id => ({ kind: 'drive', id, key: 'drive:' + id });
  window.CHEONGAM_LOCAL_ASSETS = Object.freeze({
    '1wJhtAkha1Yqgw5VF4Slh0Ji0NOwLVEIW': './assets/school-logo.png',
    '1WvKMi6elKQvY__TqByBDia8I8Xjhgzyf': './assets/school-hero.jpg',
    '1N6aBjv-QFx7vfeKGuZw6la22PLe52Fya': './assets/students-portrait.png',
    '16DagZDSXJEixGahFWAHyDwnVJzINNQYR': './assets/students-landscape.png'
  });
  window.CHEONGAM_DEFAULT_CONFIG = {
    version: '2.0.0', schoolName: '순천청암고등학교',
    logo: asset('1wJhtAkha1Yqgw5VF4Slh0Ji0NOwLVEIW'),
    hero: asset('1WvKMi6elKQvY__TqByBDia8I8Xjhgzyf'),
    slides: [
      { id:'idle_portrait', order:1, name:'햇살 가득한 직업학교의 하루', asset:asset('1N6aBjv-QFx7vfeKGuZw6la22PLe52Fya') },
      { id:'idle_landscape', order:2, name:'선생님과 함께하는 즐거운 수업', asset:asset('16DagZDSXJEixGahFWAHyDwnVJzINNQYR') }
    ],
    menus: [
      ['navigation','청암 네비게이션','https://script.google.com/macros/s/AKfycbw8SZj68fxfEUVFLYZJ8c3Dx3V3zajWu5JFYcTeWITO1IGbtqQ54xvqk7sbwnW9CKOeSA/exec'],
      ['meal','청암 급식메뉴','https://kuro095-gif.github.io/meal/'],
      ['game','날아라 청암','https://script.google.com/macros/s/AKfycby9BxRnyVRF-dM9U04OYQTqu_Kh_kQcIT1YCR-EMeFdqWil-UBXJM_1RcAAv_56G_r6CA/exec'],
      ['album','청암 포토앨범','https://sca.jge.hs.kr/sca_hs/na/ntt/selectNttList.do?mi=131823&bbsId=131823'],
      ['website','순천청암고 홈페이지','https://sca.jge.hs.kr/sca_hs/main.do?sysId=sca_hs']
    ].map(([id,name,url],i) => ({id,name,url,order:i+1,enabled:true})),
    idleSeconds:600, slideSeconds:10, refreshSeconds:60,
    idleMessage:'화면을 터치하면 메뉴가 활성화됩니다'
  };
})();
