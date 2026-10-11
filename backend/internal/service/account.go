package service

import (
	"afterframe/internal/db"
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
)

func (s *Service) EraseAccount(ctx context.Context, user string) error {
	_, e := s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		if e := q.MarkAccountDeleted(ctx); e != nil {
			return nil, e
		}
		return nil, q.DeleteAccount(ctx)
	})
	return e
}
func (s *Service) Avatar(ctx context.Context, user string, data []byte) error {
	if len(data) > 256*1024 {
		return errors.Join(ErrInvalid, errors.New("avatar must be at most 256 KB"))
	}
	cfg, format, e := image.DecodeConfig(bytes.NewReader(data))
	if e != nil || (format != "png" && format != "jpeg") || cfg.Width > 512 || cfg.Height > 512 || cfg.Width < 1 || cfg.Height < 1 {
		return errors.Join(ErrInvalid, errors.New("use a PNG or JPEG no larger than 512 × 512 pixels"))
	}
	if _, _, e = image.Decode(bytes.NewReader(data)); e != nil {
		return ErrInvalid
	}
	_, e = s.Transaction(ctx, user, func(q *db.Queries) (any, error) {
		return nil, q.SaveAvatar(ctx, "data:image/"+format+";base64,"+base64.StdEncoding.EncodeToString(data))
	})
	return e
}

// RetryErasures drains a bounded, durable deletion outbox. Private data is already gone.
func (s *Service) RetryErasures(ctx context.Context, remove func(context.Context, string) error) {
	q := db.New(s.Pool)
	ids, e := q.PendingErasures(ctx)
	if e != nil {
		return
	}
	for _, id := range ids {
		if ctx.Err() != nil {
			return
		}
		if remove(ctx, id.String()) == nil {
			q.AuthErased(ctx, id)
		}
	}
}
