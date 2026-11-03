import concurrent.futures
import json
from pathlib import Path
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'profile'
WORKS = [
    dict(id='jellyfish-eyes', title='Jellyfish Eyes', year=2013, role='Rigging & Simulation', page='https://www.yatzer.com/jellyfish-eyes-takashi-murakami', url='https://media.yatzer.com/1_jellyfish_eyes_film_takashi_murakami_yatzer-900x1267.jpg'),
    dict(id='ao-oni', title='Ao Oni', year=2014, role='Simulation', page='https://www.famitsu.com/news/201406/11054923.html', url='https://www.famitsu.com/images/000/054/923/l_5397cb6e6a838.jpg'),
    dict(id='gantz-o', title='GANTZ:O', year=2016, role='Rigging', page='https://natalie.mu/eiga/film/170410', url='https://ogre.natalie.mu/media/ex/film/170410/flyer_1.jpg?imdensity=1&imwidth=640'),
    dict(id='gantz', title='GANTZ', year=2015, role='Rigging & Simulation', medium='Pachinko', page='https://www.ok777.co.jp/lineup/gantz/', url='https://www.ok777.co.jp/lineup/gantz/img/index/character.png'),
    dict(id='guilty-crown', title='GUILTY CROWN', year=2015, role='Rigging', medium='Pachislot', page='https://www.universal-777.com/product/slot/slot_guilty_crown/', url='https://www.universal-777.com/product/img/slot_guilty_crown/slot_guilty_crown_main.jpg'),
    dict(id='giants-star', title='Giants Star', year=2014, role='Rigging & Simulation', medium='Pachinko', page='https://www.sansei-rd.com/products04/kyojin_no_hoshi/', url='https://www.sansei-rd.com/products04/kyojin_no_hoshi/images/index/hyuma.png'),
    dict(id='ultraman-zero', title='Ultraman Zero', year=2014, role='Rigging', medium='Pachinko', page='https://www.ok777.co.jp/lineup/ultrabattle/index.html', url='https://www.ok777.co.jp/lineup/ultrabattle/images/top/top_main_visual.jpg'),
    dict(id='inuyasha', title='Inuyasha', year=2013, role='Rigging & Simulation', medium='Pachislot', page='https://www.sammy.co.jp/japanese/products/pachislot/2016/index.html', url='https://www.sammy.co.jp/japanese/products/pachislot/assets_c/2018/06/P41_%E3%83%8F%E3%82%9A%E3%83%81%E3%82%B9%E3%83%AD%E7%8A%AC%E5%A4%9C%E5%8F%89-thumb-300x300-40008.jpg'),
    dict(id='souten', title='Fist of the Blue Sky', year=2012, role='Rigging & Simulation', medium='Pachinko', page='https://yoyaku-top10.jp/apps/MTI5OTE', url='https://image.yoyaku-top10.jp/uploads/capture/image/2705/7/Q42N-PT7WmqWpmmLsdj3JC1L5aoceLmxmrfGinhpbO07I3-vqrQ4MC1vv2tHWwOW68bx_h640.jpg'),
    dict(id='smash-bros', title='Super Smash Bros. for Wii U', year=2014, role='Rigging', page='https://mynintendonews.com/2014/06/10/heres-the-super-smash-bros-wii-u-and-nintendo-3ds-box-art/', url='https://sickr.files.wordpress.com/2014/06/super_smash_bros_wii_u_cover.png?w=600'),
]

def fetch(work):
    work = dict(work)
    try:
        req=urllib.request.Request(work['url'], headers={'User-Agent':'Mozilla/5.0', 'Referer':work['page']})
        data=urllib.request.urlopen(req,timeout=30).read()
        ext='.png' if data.startswith(b'\x89PNG') else '.jpg'
        path=DEST / ('df-'+work['id']+ext)
        path.write_bytes(data)
        with Image.open(path) as image:
            work.update(file='assets/profile/'+path.name,width=image.width,height=image.height,format=image.format)
        print(work['id'],work['width'],work['height'],len(data),flush=True)
        return work
    except Exception as exc:
        print(work['id'],'ERROR',str(exc),flush=True)
        work['error']=str(exc)
        return work

if __name__=='__main__':
    records=list(concurrent.futures.ThreadPoolExecutor(5).map(fetch,WORKS))
    (DEST/'df-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
