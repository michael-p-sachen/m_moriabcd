import { useEffect } from 'react';
import { FooterNavIconDownload, FooterNavIconNext, FooterNavIconPrevious } from './Icons';
import './Footer.css';
import { EDIZIONE_DOWNLOAD_FILE, EDIZIONE_DOWNLOAD_PATH } from '../../data';

type FooterProps =
  | {
      mode: 'text';
      prefixed: boolean;
    }
  | {
      mode: 'navigation';
      onPrevious: () => void;
      onNext: () => void;
      pdfPage: number;
      pdfPagesNum: number;
      downloadVisible: boolean;
    };

export const Footer = (props: FooterProps = { mode: 'text', prefixed: false }) => {
  useEffect(() => {
    if (props.mode === 'text') {
      const handleSelection = (e: MouseEvent) => {
        if (!(e.target as Element).closest('.app-footer-text__email')) {
          window.getSelection()?.removeAllRanges();
        }
      };

      document.addEventListener('mousedown', handleSelection);
      return () => document.removeEventListener('mousedown', handleSelection);
    }
  }, [props.mode]);

  const onDownload = () => {
    const text = document.createElement('a');
    Object.assign(text, { href: EDIZIONE_DOWNLOAD_PATH, download: EDIZIONE_DOWNLOAD_FILE });
    text.click();
  };

  return (
    <footer className='app-footer'>
      {props.mode === 'text' ?
        <span className={`app-footer-text ${props.prefixed ? 'app-footer-text--prefixed' : ''}`}>
          {props.prefixed && <span className='app-footer-text__prefix'>for object inquiry please contact :</span>}
          <span className='app-footer-text__email'>info@mmoriabcd.com</span>
        </span>
      : <div className='app-footer-nav'>
          <button
            type='button'
            className='app-footer-nav__btn'
            disabled={props.pdfPage <= 1}
            onClick={props.onPrevious}>
            <FooterNavIconPrevious />
          </button>
          {props.downloadVisible && (
            <button
              type='button'
              className='app-footer-nav__btn'
              onClick={onDownload}>
              <FooterNavIconDownload />
            </button>
          )}
          <button
            type='button'
            className='app-footer-nav__btn'
            disabled={props.pdfPage >= props.pdfPagesNum}
            onClick={props.onNext}>
            <FooterNavIconNext />
          </button>
        </div>
      }
    </footer>
  );
};
